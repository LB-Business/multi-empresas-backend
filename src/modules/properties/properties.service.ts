import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property, PropertyDocument } from './property.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { MercadoLibreService } from '../mercadolibre/mercadolibre.service';
import { PublishPropertyMercadoLibreDto } from './dto/publish-property-mercadolibre.dto';

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function normalizeImages(images: any[] = []) {
    if (!Array.isArray(images)) return [];

    const hasCover = images.some((img) => img.isCover);

    return images
        .filter((img) => img?.url && img?.publicId)
        .map((img, index) => ({
            url: img.url,
            publicId: img.publicId,
            order: index,
            isCover: hasCover ? !!img.isCover : index === 0,
        }));
}

function normalizeDocuments(documents: any[] = []) {
    if (!Array.isArray(documents)) return [];

    return documents
        .filter((doc) => doc?.url && doc?.publicId)
        .map((doc) => ({
            label: doc.label?.trim() || 'Documento',
            type: doc.type?.trim() || 'otro',
            url: doc.url,
            publicId: doc.publicId,
            fileName: doc.fileName?.trim() || undefined,
            mimeType: doc.mimeType?.trim() || undefined,
            uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
        }));
}

function limitText(value: string, max = 60) {
    return String(value || '').trim().slice(0, max);
}

function getRequiredString(value: any, label: string) {
    const stringValue = String(value || '').trim();

    if (!stringValue) {
        throw new BadRequestException(`${label} es obligatorio`);
    }

    return stringValue;
}

function getRequiredNumber(value: any, label: string) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
        throw new BadRequestException(
            `${label} es obligatorio y debe ser mayor a cero`,
        );
    }

    return numberValue;
}

function getRequiredCoordinate(value: any, label: string) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
        throw new BadRequestException(`${label} es obligatorio`);
    }

    return numberValue;
}

function getRequiredInteger(value: any, label: string, min = 0) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue < min) {
        throw new BadRequestException(
            `${label} es obligatorio y debe ser mayor o igual a ${min}`,
        );
    }

    return Math.trunc(numberValue);
}

function buildAddressLine(property: any, dtoLocation?: any) {
    const address = property.address ?? {};

    const dtoAddressLine =
        dtoLocation?.address_line ||
        dtoLocation?.addressLine ||
        dtoLocation?.address;

    if (dtoAddressLine) return String(dtoAddressLine).trim();

    const street = String(address.street || '').trim();
    const number = String(address.number || '').trim();

    const joined = [street, number].filter(Boolean).join(' ').trim();

    if (joined) return joined;

    return 'Dirección a consultar';
}

function resolveMercadoLibreLocation(property: any, dtoLocation?: any) {
    const address = property.address ?? {};

    const neighborhoodName =
        dtoLocation?.neighborhood?.name ||
        dtoLocation?.neighborhoodName ||
        dtoLocation?.neighborhood ||
        address.neighborhood;

    const neighborhoodId =
        dtoLocation?.neighborhood?.id ||
        dtoLocation?.neighborhoodId ||
        '';

    const cityName =
        dtoLocation?.city?.name ||
        dtoLocation?.cityName ||
        dtoLocation?.city ||
        address.city;

    const cityId =
        dtoLocation?.city?.id ||
        dtoLocation?.cityId ||
        '';

    const stateName =
        dtoLocation?.state?.name ||
        dtoLocation?.stateName ||
        dtoLocation?.state ||
        address.state;

    const stateId =
        dtoLocation?.state?.id ||
        dtoLocation?.stateId ||
        '';

    const countryName =
        dtoLocation?.country?.name ||
        dtoLocation?.countryName ||
        dtoLocation?.country ||
        address.country ||
        'Argentina';

    const countryId =
        dtoLocation?.country?.id ||
        dtoLocation?.countryId ||
        'AR';

    const latitude =
        dtoLocation?.latitude ??
        dtoLocation?.lat ??
        address.latitude;

    const longitude =
        dtoLocation?.longitude ??
        dtoLocation?.lng ??
        address.longitude;

    return {
        address_line: buildAddressLine(property, dtoLocation),
        zip_code: String(dtoLocation?.zip_code || dtoLocation?.zipCode || ''),
        neighborhood: {
            id: String(neighborhoodId || ''),
            name: getRequiredString(neighborhoodName, 'location.neighborhood.name'),
        },
        city: {
            id: String(cityId || ''),
            name: getRequiredString(cityName, 'location.city.name'),
        },
        state: {
            id: String(stateId || ''),
            name: getRequiredString(stateName, 'location.state.name'),
        },
        country: {
            id: String(countryId || 'AR'),
            name: getRequiredString(countryName, 'location.country.name'),
        },
        latitude: getRequiredCoordinate(latitude, 'location.latitude'),
        longitude: getRequiredCoordinate(longitude, 'location.longitude'),
    };
}

function numberUnitAttribute(id: string, name: string, value: number, unit = 'm²') {
    return {
        id,
        name,
        value_id: null,
        value_name: `${value} ${unit}`,
        value_struct: {
            number: value,
            unit,
        },
        values: [
            {
                id: null,
                name: `${value} ${unit}`,
                struct: {
                    number: value,
                    unit,
                },
            },
        ],
        attribute_group_id: 'FIND',
        attribute_group_name: 'Ficha técnica',
        value_type: 'number_unit',
    };
}

function numberAttribute(id: string, name: string, value: number) {
    return {
        id,
        name,
        value_id: null,
        value_name: String(value),
        value_struct: null,
        values: [
            {
                id: null,
                name: String(value),
                struct: null,
            },
        ],
        attribute_group_id: 'FIND',
        attribute_group_name: 'Ficha técnica',
        value_type: 'number',
    };
}

const ML_REQUIRED_ATTRIBUTES_BY_CATEGORY: Record<string, string[]> = {
    "MLA374731": [],
    "MLA374732": [],
    "MLA6414": [
        "TOTAL_AREA",
        "LAND_ACCESS",
        "BEDROOMS",
        "FULL_BATHROOMS"
    ],
    "MLA6413": [
        "TOTAL_AREA",
        "LAND_ACCESS",
        "BEDROOMS",
        "FULL_BATHROOMS"
    ],
    "MLA1467": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA50278": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "GUESTS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA401805": [
        "MODEL_NAME",
        "COVERED_AREA",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS",
        "UNIT_NAME",
        "TOTAL_AREA",
        "DEVELOPMENT_NAME",
        "POSSESSION_STATUS"
    ],
    "MLA401685": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA50542": [
        "TOTAL_AREA"
    ],
    "MLA50543": [
        "TOTAL_AREA"
    ],
    "MLA392266": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA392267": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA1473": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA50279": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "GUESTS",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA401806": [
        "MODEL_NAME",
        "COVERED_AREA",
        "TOTAL_AREA",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "UNIT_NAME",
        "PARKING_LOTS",
        "DEVELOPMENT_NAME",
        "POSSESSION_STATUS"
    ],
    "MLA401686": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA1476": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA1477": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA50546": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA50550": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA79243": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA79244": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA50539": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "PARKING_LOTS",
        "FULL_BATHROOMS"
    ],
    "MLA401804": [
        "MODEL_NAME",
        "COVERED_AREA",
        "FULL_BATHROOMS",
        "UNIT_NAME",
        "PARKING_LOTS",
        "DEVELOPMENT_NAME",
        "POSSESSION_STATUS"
    ],
    "MLA401684": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "PARKING_LOTS",
        "FULL_BATHROOMS"
    ],
    "MLA6395": [
        "TOTAL_AREA",
        "COVERED_AREA"
    ],
    "MLA50283": [
        "TOTAL_AREA",
        "COVERED_AREA"
    ],
    "MLA6396": [
        "TOTAL_AREA",
        "COVERED_AREA"
    ],
    "MLA105181": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA105180": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "GUESTS",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA105182": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA50548": [],
    "MLA50549": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "LAND_ACCESS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA52745": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "GUESTS",
        "BEDROOMS",
        "FULL_BATHROOMS"
    ],
    "MLA458174": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "LAND_ACCESS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA458173": [
        "MODEL_NAME",
        "TOTAL_AREA",
        "UNIT_NAME",
        "DEVELOPMENT_NAME",
        "POSSESSION_STATUS"
    ],
    "MLA1494": [
        "TOTAL_AREA",
        "LAND_ACCESS"
    ],
    "MLA401803": [
        "MODEL_NAME",
        "TOTAL_AREA",
        "UNIT_NAME",
        "DEVELOPMENT_NAME",
        "POSSESSION_STATUS"
    ],
    "MLA401687": [
        "TOTAL_AREA",
        "LAND_ACCESS"
    ],
    "MLA52741": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "GUESTS",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ],
    "MLA50537": [
        "TOTAL_AREA",
        "COVERED_AREA",
        "GUESTS",
        "ROOMS",
        "BEDROOMS",
        "FULL_BATHROOMS",
        "PARKING_LOTS"
    ]
};

const ML_FALLBACK_REQUIRED_ATTRIBUTES = [
    'TOTAL_AREA',
    'COVERED_AREA',
    'BEDROOMS',
    'FULL_BATHROOMS',
    'PARKING_LOTS',
];

const ML_BASE_ATTRIBUTE_IDS = new Set([
    'TOTAL_AREA',
    'COVERED_AREA',
    'ROOMS',
    'BEDROOMS',
    'FULL_BATHROOMS',
    'PARKING_LOTS',
]);

function getCategoryRequiredAttributes(categoryId: string) {
    return (
        ML_REQUIRED_ATTRIBUTES_BY_CATEGORY[categoryId] ||
        ML_FALLBACK_REQUIRED_ATTRIBUTES
    );
}

function normalizeIncomingAttributes(attributes: any[] | undefined) {
    return Array.isArray(attributes)
        ? attributes.filter((attr) => {
            if (!attr) return false;
            if (Array.isArray(attr)) return false;
            if (typeof attr !== 'object') return false;
            if (!attr.id || typeof attr.id !== 'string') return false;
            return true;
        })
        : [];
}

function findIncomingAttribute(
    attributes: any[] | undefined,
    attributeId: string,
) {
    return normalizeIncomingAttributes(attributes).find(
        (attr) => attr.id === attributeId,
    );
}

function cleanIncomingMercadoLibreAttribute(attr: any) {
    const cleanAttr: any = {
        id: attr.id,
    };

    if (attr.name) cleanAttr.name = attr.name;
    if (attr.value_id !== undefined) cleanAttr.value_id = attr.value_id;
    if (attr.value_name !== undefined) cleanAttr.value_name = attr.value_name;
    if (attr.value_struct !== undefined) cleanAttr.value_struct = attr.value_struct;
    if (attr.values !== undefined) cleanAttr.values = attr.values;
    if (attr.attribute_group_id) cleanAttr.attribute_group_id = attr.attribute_group_id;
    if (attr.attribute_group_name) cleanAttr.attribute_group_name = attr.attribute_group_name;
    if (attr.value_type) cleanAttr.value_type = attr.value_type;

    return cleanAttr;
}

function getIncomingAttributeValue(
    attributes: any[] | undefined,
    attributeId: string,
) {
    const found = findIncomingAttribute(attributes, attributeId);

    if (!found) return null;

    return found.value_name || found.value_id || null;
}

function buildBaseAttributeFromProperty(attributeId: string, property: any) {
    const features = property.features ?? {};

    if (attributeId === 'TOTAL_AREA') {
        return numberUnitAttribute(
            'TOTAL_AREA',
            'Superficie total',
            getRequiredNumber(features.totalArea, 'TOTAL_AREA / Metros totales'),
        );
    }

    if (attributeId === 'COVERED_AREA') {
        return numberUnitAttribute(
            'COVERED_AREA',
            'Superficie cubierta',
            getRequiredNumber(features.coveredArea, 'COVERED_AREA / Metros cubiertos'),
        );
    }

    if (attributeId === 'ROOMS') {
        return numberAttribute(
            'ROOMS',
            'Ambientes',
            getRequiredInteger(features.rooms, 'ROOMS / Ambientes', 1),
        );
    }

    if (attributeId === 'BEDROOMS') {
        return numberAttribute(
            'BEDROOMS',
            'Dormitorios',
            getRequiredInteger(features.bedrooms, 'BEDROOMS / Dormitorios', 1),
        );
    }

    if (attributeId === 'FULL_BATHROOMS') {
        return numberAttribute(
            'FULL_BATHROOMS',
            'Baños',
            getRequiredInteger(features.bathrooms, 'FULL_BATHROOMS / Baños', 1),
        );
    }

    if (attributeId === 'PARKING_LOTS') {
        return numberAttribute(
            'PARKING_LOTS',
            'Cocheras',
            getRequiredInteger(features.garages ?? 0, 'PARKING_LOTS / Cocheras', 0),
        );
    }

    return null;
}

function defaultExtraAttribute(attributeId: string, property: any) {
    const title = String(property.title || 'Propiedad').trim() || 'Propiedad';
    const features = property.features ?? {};

    if (attributeId === 'LAND_ACCESS') {
        return {
            id: 'LAND_ACCESS',
            value_id: '245046',
        };
    }

    if (attributeId === 'GUESTS') {
        const guests = Number(features.bedrooms || features.rooms || 1);

        return {
            id: 'GUESTS',
            value_name: String(Number.isFinite(guests) && guests > 0 ? guests : 1),
        };
    }

    if (attributeId === 'MODEL_NAME') {
        return { id: 'MODEL_NAME', value_name: title };
    }

    if (attributeId === 'UNIT_NAME') {
        return { id: 'UNIT_NAME', value_name: title };
    }

    if (attributeId === 'DEVELOPMENT_NAME') {
        return { id: 'DEVELOPMENT_NAME', value_name: title };
    }

    if (attributeId === 'POSSESSION_STATUS') {
        return {
            id: 'POSSESSION_STATUS',
            value_id: '242413',
        };
    }

    return null;
}

function buildRequiredExtraAttribute(
    attributeId: string,
    property: any,
    dtoAttributes: any[] | undefined,
) {
    const incoming = findIncomingAttribute(dtoAttributes, attributeId);

    if (incoming) {
        return cleanIncomingMercadoLibreAttribute(incoming);
    }

    const fallback = defaultExtraAttribute(attributeId, property);

    if (fallback) return fallback;

    throw new BadRequestException(
        `El atributo ${attributeId} es obligatorio para esta categoría de Mercado Libre`,
    );
}

function buildRealEstateAttributes(
    property: any,
    dtoAttributes: any[] | undefined,
    categoryId: string,
    categoryAttributes: any[] = [],
) {
    const requiredIds = getCategoryRequiredAttributes(categoryId);
    const incomingAttributes = normalizeIncomingAttributes(dtoAttributes);
    const usedIds = new Set<string>();
    const requiredAttributes: any[] = [];

    requiredIds.forEach((attributeId) => {
        if (ML_BASE_ATTRIBUTE_IDS.has(attributeId)) {
            const baseAttribute = buildBaseAttributeFromProperty(attributeId, property);

            if (baseAttribute) {
                requiredAttributes.push(baseAttribute);
                usedIds.add(attributeId);
            }

            return;
        }

        const extraAttribute = buildRequiredExtraAttribute(
            attributeId,
            property,
            dtoAttributes,
        );

        if (extraAttribute) {
            requiredAttributes.push(extraAttribute);
            usedIds.add(attributeId);
        }
    });

    const extraAttributes = incomingAttributes
        .filter((attr) => !usedIds.has(attr.id) && attr.id !== 'ITEM_CONDITION')
        .map((attr) => cleanIncomingMercadoLibreAttribute(attr));

    const automaticOptionalAttributes = buildAutomaticOptionalAttributes(
        property,
        categoryAttributes,
    ).filter(
        (attr) =>
            !usedIds.has(attr.id) &&
            !extraAttributes.some((incoming) => incoming.id === attr.id),
    );

    return [
        ...requiredAttributes,
        ...extraAttributes,
        ...automaticOptionalAttributes,
    ];
}

function normalizeAttributeText(value: any) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function findCategoryAttribute(
    categoryAttributes: any[],
    ids: string[],
    nameHints: string[] = [],
) {
    const normalizedIds = new Set(ids.map((id) => id.toUpperCase()));

    const byId = categoryAttributes.find((attribute) =>
        normalizedIds.has(String(attribute?.id || '').toUpperCase()),
    );

    if (byId) return byId;

    const normalizedHints = nameHints.map(normalizeAttributeText);

    return categoryAttributes.find((attribute) => {
        const name = normalizeAttributeText(attribute?.name);
        return normalizedHints.some((hint) => name.includes(hint));
    });
}

function buildAttributeFromDefinition(definition: any, value: any) {
    if (!definition?.id) return null;

    const valueType = String(definition.value_type || 'string');

    if (typeof value === 'boolean') {
        const expectedNames = value
            ? new Set(['si', 'yes', 'true'])
            : new Set(['no', 'false']);

        const selectedValue = Array.isArray(definition.values)
            ? definition.values.find((item: any) =>
                expectedNames.has(normalizeAttributeText(item?.name)),
            )
            : undefined;

        if (selectedValue?.id) {
            return {
                id: definition.id,
                value_id: String(selectedValue.id),
            };
        }

        return {
            id: definition.id,
            value_name: value ? 'Sí' : 'No',
        };
    }

    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
        if (valueType === 'number_unit') {
            const unit =
                definition.default_unit ||
                definition.allowed_units?.[0]?.id ||
                definition.allowed_units?.[0]?.name ||
                '';

            return {
                id: definition.id,
                value_name: unit ? `${numericValue} ${unit}` : String(numericValue),
                value_struct: unit
                    ? {
                        number: numericValue,
                        unit,
                    }
                    : undefined,
            };
        }

        return {
            id: definition.id,
            value_name: String(numericValue),
        };
    }

    const stringValue = String(value ?? '').trim();

    if (!stringValue) return null;

    return {
        id: definition.id,
        value_name: stringValue,
    };
}

function buildAutomaticOptionalAttributes(
    property: any,
    categoryAttributes: any[],
) {
    if (!Array.isArray(categoryAttributes) || !categoryAttributes.length) {
        return [];
    }

    const features = property.features ?? {};
    const result: any[] = [];

    const append = (
        ids: string[],
        nameHints: string[],
        value: any,
        include: boolean,
    ) => {
        if (!include) return;

        const definition = findCategoryAttribute(
            categoryAttributes,
            ids,
            nameHints,
        );

        if (!definition) return;

        const attribute = buildAttributeFromDefinition(definition, value);

        if (attribute) result.push(attribute);
    };

    append(
        ['MAINTENANCE_FEE'],
        ['expensas', 'gasto comun', 'mantenimiento'],
        Number(property.expenses),
        Number(property.expenses) > 0,
    );

    append(
        ['PROPERTY_AGE', 'AGE'],
        ['antiguedad'],
        Number(features.age),
        Number.isFinite(Number(features.age)) && Number(features.age) >= 0,
    );

    append(
        ['FLOORS', 'NUMBER_OF_FLOORS'],
        ['cantidad de pisos', 'pisos'],
        Number(features.floors),
        Number(features.floors) > 0,
    );

    const booleanFeatures = [
        {
            ids: ['HAS_SWIMMING_POOL', 'HAS_POOL'],
            hints: ['pileta', 'piscina'],
            value: features.hasPool,
        },
        {
            ids: ['HAS_GRILL'],
            hints: ['parrilla', 'quincho'],
            value: features.hasGrill,
        },
        {
            ids: ['HAS_GARDEN'],
            hints: ['jardin'],
            value: features.hasGarden,
        },
        {
            ids: ['HAS_SECURITY'],
            hints: ['seguridad'],
            value: features.hasSecurity,
        },
        {
            ids: ['HAS_ELEVATOR'],
            hints: ['ascensor'],
            value: features.hasElevator,
        },
        {
            ids: ['HAS_BALCONY'],
            hints: ['balcon'],
            value: features.hasBalcony,
        },
        {
            ids: ['HAS_TERRACE'],
            hints: ['terraza'],
            value: features.hasTerrace,
        },
    ];

    booleanFeatures.forEach(({ ids, hints, value }) => {
        append(ids, hints, !!value, typeof value === 'boolean');
    });

    return result;
}

async function getMercadoLibreCategoryAttributes(
    categoryId: string,
    accessToken: string,
) {
    try {
        const response = await fetch(
            `https://api.mercadolibre.com/categories/${encodeURIComponent(categoryId)}/attributes`,
            {
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    accept: 'application/json',
                },
            },
        );

        if (!response.ok) return [];

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch {
        // Los atributos principales siguen publicándose aunque Mercado Libre
        // no permita consultar temporalmente los atributos opcionales.
        return [];
    }
}

async function publishMercadoLibreDescription(
    itemId: string,
    description: string,
    accessToken: string,
) {
    const plainText = String(description || '').trim();

    if (!itemId || !plainText) return;

    const response = await fetch(
        `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}/description`,
        {
            method: 'POST',
            headers: {
                authorization: `Bearer ${accessToken}`,
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ plain_text: plainText }),
        },
    );

    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `La publicación fue creada, pero no se pudo cargar la descripción: ${body || response.status}`,
        );
    }
}

async function readMercadoLibreJson<T>(res: Response): Promise<T> {
    const text = await res.text();

    let data: any = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { raw: text };
    }

    // Mercado Libre a veces devuelve 402 payment_required,
    // pero igualmente crea el item y devuelve id/permalink/status.
    // En ese caso NO lo tratamos como error fatal.
    if (res.status === 402 && data?.id) {
        return data as T;
    }

    if (!res.ok) {
        throw new BadRequestException({
            message: data?.message || data?.error || 'Error Mercado Libre',
            status: res.status,
            data,
        });
    }

    return data as T;
}

function extractMercadoLibreError(err: any) {
    if (typeof err?.getResponse === 'function') {
        return err.getResponse();
    }

    return err?.response || err;
}

@Injectable()
export class PropertiesService {
    constructor(
        @InjectModel(Property.name)
        private readonly propertyModel: Model<PropertyDocument>,
        private readonly mercadoLibreService: MercadoLibreService,
    ) { }

    async findAll(
        businessId: string,
        filters: {
            status?: string;
            operationType?: string;
            propertyType?: string;
            showOnLanding?: string;
            search?: string;
        },
    ) {
        const query: any = {
            businessId: new Types.ObjectId(businessId),
        };

        if (filters.status) query.status = filters.status;
        if (filters.operationType) query.operationType = filters.operationType;
        if (filters.propertyType) query.propertyType = filters.propertyType;

        if (filters.showOnLanding === 'true') query.showOnLanding = true;
        if (filters.showOnLanding === 'false') query.showOnLanding = false;

        if (filters.search?.trim()) {
            const regex = new RegExp(filters.search.trim(), 'i');

            query.$or = [
                { title: regex },
                { description: regex },
                { 'address.street': regex },
                { 'address.neighborhood': regex },
                { 'address.city': regex },
            ];
        }

        return this.propertyModel.find(query).sort({ createdAt: -1 }).lean();
    }

    async findOne(id: string, businessId: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID inválido');
        }

        const property = await this.propertyModel
            .findOne({
                _id: new Types.ObjectId(id),
                businessId: new Types.ObjectId(businessId),
            })
            .lean();

        if (!property) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return property;
    }

    async create(dto: CreatePropertyDto, businessId: string, userId?: string) {
        const title = dto.title?.trim();

        if (!title) {
            throw new BadRequestException('El título es obligatorio');
        }

        const slug = slugify(dto.slug || title);

        if (!slug) {
            throw new BadRequestException('El slug es obligatorio');
        }

        const exists = await this.propertyModel.exists({
            businessId: new Types.ObjectId(businessId),
            slug,
        });

        if (exists) {
            throw new BadRequestException('Ya existe una propiedad con ese slug');
        }

        const created = await this.propertyModel.create({
            ...dto,
            businessId: new Types.ObjectId(businessId),
            title,
            slug,
            description: dto.description ?? '',
            operationType: dto.operationType ?? 'venta',
            propertyType: dto.propertyType ?? 'casa',
            status: dto.status ?? 'draft',
            showOnLanding: dto.showOnLanding ?? false,
            price: Number(dto.price ?? 0),
            currency: dto.currency ?? 'USD',
            expenses: Number(dto.expenses ?? 0),
            acceptsFinancing: dto.acceptsFinancing ?? false,
            acceptsExchange: dto.acceptsExchange ?? false,
            address: dto.address ?? {},
            features: dto.features ?? {},
            images: normalizeImages(dto.images),
            documents: normalizeDocuments(dto.documents),
            internalNotes: dto.internalNotes ?? '',
            createdBy:
                userId && Types.ObjectId.isValid(userId)
                    ? new Types.ObjectId(userId)
                    : undefined,
            updatedBy:
                userId && Types.ObjectId.isValid(userId)
                    ? new Types.ObjectId(userId)
                    : undefined,
        });

        return created.toObject();
    }

    async update(
        id: string,
        dto: UpdatePropertyDto,
        businessId: string,
        userId?: string,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID inválido');
        }

        const current = await this.propertyModel.findOne({
            _id: new Types.ObjectId(id),
            businessId: new Types.ObjectId(businessId),
        });

        if (!current) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        const nextTitle = dto.title?.trim() ?? current.title;
        const nextSlug = dto.slug
            ? slugify(dto.slug)
            : dto.title
                ? slugify(dto.title)
                : current.slug;

        if (!nextTitle) {
            throw new BadRequestException('El título es obligatorio');
        }

        if (!nextSlug) {
            throw new BadRequestException('El slug es obligatorio');
        }

        if (nextSlug !== current.slug) {
            const exists = await this.propertyModel.exists({
                _id: { $ne: current._id },
                businessId: new Types.ObjectId(businessId),
                slug: nextSlug,
            });

            if (exists) {
                throw new BadRequestException('Ya existe una propiedad con ese slug');
            }
        }

        const payload: any = {
            ...dto,
            title: nextTitle,
            slug: nextSlug,
            updatedBy:
                userId && Types.ObjectId.isValid(userId)
                    ? new Types.ObjectId(userId)
                    : undefined,
        };

        if (dto.images) {
            payload.images = normalizeImages(dto.images);
        }

        if (dto.documents) {
            payload.documents = normalizeDocuments(dto.documents);
        }

        if (dto.price !== undefined) payload.price = Number(dto.price ?? 0);
        if (dto.expenses !== undefined) {
            payload.expenses = Number(dto.expenses ?? 0);
        }

        const updated = await this.propertyModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(id),
                    businessId: new Types.ObjectId(businessId),
                },
                {
                    $set: payload,
                },
                {
                    new: true,
                },
            )
            .lean();

        return updated;
    }

    async updateStatus(id: string, status: string, businessId: string) {
        if (
            !['draft', 'published', 'paused', 'sold', 'rented', 'archived'].includes(
                status,
            )
        ) {
            throw new BadRequestException('Estado inválido');
        }

        const updated = await this.propertyModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(id),
                    businessId: new Types.ObjectId(businessId),
                },
                {
                    $set: {
                        status,
                    },
                },
                {
                    new: true,
                },
            )
            .lean();

        if (!updated) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return updated;
    }

    async updateShowOnLanding(
        id: string,
        showOnLanding: boolean,
        businessId: string,
    ) {
        const updated = await this.propertyModel
            .findOneAndUpdate(
                {
                    _id: new Types.ObjectId(id),
                    businessId: new Types.ObjectId(businessId),
                },
                {
                    $set: {
                        showOnLanding,
                    },
                },
                {
                    new: true,
                },
            )
            .lean();

        if (!updated) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return updated;
    }

    async publishToMercadoLibre(
        id: string,
        dto: PublishPropertyMercadoLibreDto,
        businessId: string,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('ID inválido');
        }

        const dtoAny = dto as any;

        const property = await this.propertyModel.findOne({
            _id: new Types.ObjectId(id),
            businessId: new Types.ObjectId(businessId),
        });

        if (!property) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        if (property.ml?.itemId && !dto.force) {
            throw new BadRequestException(
                'La propiedad ya tiene una publicación en Mercado Libre. Usá force=true si querés republicar.',
            );
        }

        if (!dto.categoryId?.trim()) {
            throw new BadRequestException('categoryId es obligatorio');
        }

        const images = [...(property.images ?? [])].sort(
            (a: any, b: any) => Number(a.order ?? 0) - Number(b.order ?? 0),
        );

        if (!images.length) {
            throw new BadRequestException(
                'La propiedad necesita al menos una imagen para publicar en Mercado Libre',
            );
        }

        const price = Number(dto.price ?? property.price ?? 0);

        if (!price || price <= 0) {
            throw new BadRequestException(
                'La propiedad necesita un precio mayor a cero',
            );
        }

        const condition = dto.condition ?? 'used';
        const categoryId = dto.categoryId.trim();

        const accessToken =
            await this.mercadoLibreService.getValidAccessToken(businessId);

        const categoryAttributes =
            await getMercadoLibreCategoryAttributes(categoryId, accessToken);

        const attributes = buildRealEstateAttributes(
            property,
            dto.attributes,
            categoryId,
            categoryAttributes,
        );

        const location = resolveMercadoLibreLocation(
            property,
            dtoAny.location,
        );

        const titleBase = dto.title?.trim() || property.title;
        const title = limitText(
            dto.testMode ? `Propiedad de Test - ${titleBase}` : titleBase,
            60,
        );

        const payload: any = {
            title,
            listing_type_id: dto.listingTypeId || 'silver',
            category_id: categoryId,
            currency_id: dto.currencyId || property.currency || 'ARS',
            price,
            available_quantity: 1,
            attributes,
            condition,
            location,
            pictures: images.slice(0, 10).map((image: any) => ({
                source: image.url,
            })),
            seller_custom_field: `lb-property-${property._id.toString()}`,
        };

        if (dto.buyingMode) {
            payload.buying_mode = dto.buyingMode;
        }

        try {
            const res = await fetch('https://api.mercadolibre.com/items', {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${accessToken}`,
                    accept: 'application/json',
                    'content-type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const mlItem = await readMercadoLibreJson<any>(res);

            const mlStatus = mlItem.status || 'unknown';
            let descriptionWarning: string | null = null;

            if (mlItem.id && property.description) {
                try {
                    await publishMercadoLibreDescription(
                        mlItem.id,
                        property.description,
                        accessToken,
                    );
                } catch (descriptionError: any) {
                    descriptionWarning =
                        descriptionError?.message ||
                        'La publicación fue creada, pero no se pudo cargar la descripción.';
                }
            }

            const updated = await this.propertyModel
                .findOneAndUpdate(
                    {
                        _id: new Types.ObjectId(id),
                        businessId: new Types.ObjectId(businessId),
                    },
                    {
                        $set: {
                            status: 'published',
                            showOnLanding: true,
                            ml: {
                                itemId: mlItem.id,
                                status: mlStatus,
                                permalink: mlItem.permalink,
                                categoryId: mlItem.category_id,
                                listingTypeId: mlItem.listing_type_id,
                                lastSyncAt: new Date(),
                                publishedAt: new Date(),
                                errorMessage:
                                    mlStatus === 'payment_required'
                                        ? 'Mercado Libre creó la publicación pero requiere pago o activación del paquete.'
                                        : descriptionWarning,
                            },
                        },
                    },
                    {
                        new: true,
                    },
                )
                .lean();

            return {
                ok: mlItem.status !== 'payment_required',
                needsPayment: mlItem.status === 'payment_required',
                property: updated,
                mercadoLibre: {
                    id: mlItem.id,
                    status: mlItem.status,
                    permalink: mlItem.permalink,
                    categoryId: mlItem.category_id,
                    listingTypeId: mlItem.listing_type_id,
                },
                descriptionWarning,
                sentPayload: payload,
            };
        } catch (err: any) {
            const response = extractMercadoLibreError(err);

            const message =
                response?.message ||
                response?.error ||
                err?.message ||
                'No se pudo publicar en Mercado Libre';

            await this.propertyModel.findOneAndUpdate(
                {
                    _id: new Types.ObjectId(id),
                    businessId: new Types.ObjectId(businessId),
                },
                {
                    $set: {
                        'ml.lastSyncAt': new Date(),
                        'ml.errorMessage':
                            typeof message === 'string' ? message : JSON.stringify(message),
                    },
                },
            );

            throw err;
        }
    }

    async remove(id: string, businessId: string) {
        const deleted = await this.propertyModel.findOneAndDelete({
            _id: new Types.ObjectId(id),
            businessId: new Types.ObjectId(businessId),
        });

        if (!deleted) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return {
            ok: true,
        };
    }

    async findPublicLandingByBusinessSlug(businessSlug: string) {
        const result = await this.propertyModel.aggregate([
            {
                $lookup: {
                    from: 'businesses',
                    localField: 'businessId',
                    foreignField: '_id',
                    as: 'business',
                },
            },
            {
                $unwind: '$business',
            },
            {
                $match: {
                    'business.slug': businessSlug,
                    'business.isActive': true,
                    showOnLanding: true,
                    status: 'published',
                },
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $addFields: {
                    coverImage: {
                        $ifNull: [
                            {
                                $first: {
                                    $filter: {
                                        input: '$images',
                                        as: 'image',
                                        cond: { $eq: ['$$image.isCover', true] },
                                    },
                                },
                            },
                            { $first: '$images' },
                        ],
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    slug: 1,
                    description: 1,
                    operationType: 1,
                    propertyType: 1,
                    status: 1,
                    price: 1,
                    currency: 1,
                    expenses: 1,
                    acceptsFinancing: 1,
                    acceptsExchange: 1,

                    address: {
                        street: {
                            $cond: ['$address.showExactLocation', '$address.street', null],
                        },
                        number: {
                            $cond: ['$address.showExactLocation', '$address.number', null],
                        },
                        neighborhood: '$address.neighborhood',
                        city: '$address.city',
                        state: '$address.state',
                        country: '$address.country',
                        latitude: {
                            $cond: ['$address.showExactLocation', '$address.latitude', null],
                        },
                        longitude: {
                            $cond: ['$address.showExactLocation', '$address.longitude', null],
                        },
                        showExactLocation: '$address.showExactLocation',
                    },

                    features: 1,

                    images: {
                        $map: {
                            input: '$images',
                            as: 'image',
                            in: {
                                url: '$$image.url',
                                publicId: '$$image.publicId',
                                order: '$$image.order',
                                isCover: '$$image.isCover',
                            },
                        },
                    },

                    coverImage: {
                        url: '$coverImage.url',
                        publicId: '$coverImage.publicId',
                        order: '$coverImage.order',
                        isCover: '$coverImage.isCover',
                    },

                    createdAt: 1,
                    updatedAt: 1,

                    business: {
                        _id: '$business._id',
                        name: '$business.name',
                        slug: '$business.slug',
                        logoUrl: '$business.logoUrl',
                        contactPhone: '$business.contactPhone',
                        publicEmail: '$business.publicEmail',
                        address: '$business.address',
                        description: '$business.description',
                        domain: '$business.domain',
                        primaryColor: '$business.primaryColor',
                        secondaryColor: '$business.secondaryColor',
                        businessType: '$business.businessType',
                    },
                },
            },
        ]);

        const business = result[0]?.business ?? null;

        return {
            business,
            properties: result.map((property) => {
                const { business: _business, ...cleanProperty } = property;
                return cleanProperty;
            }),
        };
    }

    async findPublicLandingOneBySlug(
        businessSlug: string,
        propertySlug: string,
    ) {
        const result = await this.propertyModel.aggregate([
            {
                $lookup: {
                    from: 'businesses',
                    localField: 'businessId',
                    foreignField: '_id',
                    as: 'business',
                },
            },
            {
                $unwind: '$business',
            },
            {
                $match: {
                    'business.slug': businessSlug,
                    'business.isActive': true,
                    slug: propertySlug,
                    showOnLanding: true,
                    status: 'published',
                },
            },
            {
                $addFields: {
                    coverImage: {
                        $ifNull: [
                            {
                                $first: {
                                    $filter: {
                                        input: '$images',
                                        as: 'image',
                                        cond: { $eq: ['$$image.isCover', true] },
                                    },
                                },
                            },
                            { $first: '$images' },
                        ],
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    slug: 1,
                    description: 1,
                    operationType: 1,
                    propertyType: 1,
                    status: 1,
                    price: 1,
                    currency: 1,
                    expenses: 1,
                    acceptsFinancing: 1,
                    acceptsExchange: 1,

                    address: {
                        street: {
                            $cond: ['$address.showExactLocation', '$address.street', null],
                        },
                        number: {
                            $cond: ['$address.showExactLocation', '$address.number', null],
                        },
                        neighborhood: '$address.neighborhood',
                        city: '$address.city',
                        state: '$address.state',
                        country: '$address.country',
                        latitude: {
                            $cond: ['$address.showExactLocation', '$address.latitude', null],
                        },
                        longitude: {
                            $cond: ['$address.showExactLocation', '$address.longitude', null],
                        },
                        showExactLocation: '$address.showExactLocation',
                    },

                    features: 1,

                    images: {
                        $map: {
                            input: '$images',
                            as: 'image',
                            in: {
                                url: '$$image.url',
                                publicId: '$$image.publicId',
                                order: '$$image.order',
                                isCover: '$$image.isCover',
                            },
                        },
                    },

                    coverImage: {
                        url: '$coverImage.url',
                        publicId: '$coverImage.publicId',
                        order: '$coverImage.order',
                        isCover: '$coverImage.isCover',
                    },

                    createdAt: 1,
                    updatedAt: 1,

                    business: {
                        _id: '$business._id',
                        name: '$business.name',
                        slug: '$business.slug',
                        logoUrl: '$business.logoUrl',
                        contactPhone: '$business.contactPhone',
                        publicEmail: '$business.publicEmail',
                        address: '$business.address',
                        description: '$business.description',
                        domain: '$business.domain',
                        primaryColor: '$business.primaryColor',
                        secondaryColor: '$business.secondaryColor',
                        businessType: '$business.businessType',
                    },
                },
            },
            {
                $limit: 1,
            },
        ]);

        if (!result.length) {
            throw new NotFoundException('Propiedad no encontrada');
        }

        return result[0];
    }
}