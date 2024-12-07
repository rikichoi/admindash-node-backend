import { z } from "zod";

const envSchema = z.object({
    MONGO_DB_CONNECTION_STRING: z.string().url(),
    PORT: z.coerce.number().min(1000),
    JWT_SECRET: z.string(),
    STRIPE_SECRET_KEY: z.string(),
    BUCKET_NAME: z.string(),
    BUCKET_REGION: z.string(),
    ACCESS_KEY: z.string(),
    SECRET_ACCESS_KEY: z.string(),
    AWS_SES_IAM_USERNAME: z.string(),
    AWS_SES_SMTP_USERNAME: z.string(),
    AWS_SES_PASSWORD: z.string(),
    AWS_SES_IAM_REGION: z.string(),
});

export const envSanitisedSchema = envSchema.parse(process.env);

export const userSchema = z.object({
    password: z.string().min(1, "Password is required!"),
    email: z.string().email().min(5, "Email is required!")
})

export type UserSchema = z.infer<typeof userSchema>;

export const createUserSchema = z.object({
    name: z.string().min(1, "Username is Required!"),
    password: z.string().min(1, "Password is required!"),
    email: z.string().email().min(5, "Email is required!")
})

export type CreateUserSchema = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
    name: z.string().optional(),
    password: z.string().optional(),
    email: z.string().email().optional()
}).refine((values) => {
    for (const val of Object.values(values)) {
        if (val !== undefined) return true;
    } return false;
}, {
    message: "Object must have at least one property defined"
});

// const MAX_FILE_SIZE = 5000000;
// const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const editItemSchema = z.object({
    summary: z.string().min(1, "Required"),
    description: z.string().min(1, "Required"),
    name: z.string().min(1, "Required"),
    donationGoalValue: z.string().min(1, "Required").regex(/^(0|[1-9]\d*(\.\d{1})?|0\.\d{1})$/, "Must be a number"),
    totalDonationValue: z.string().min(1, "Required").regex(/^(0|[1-9]\d*(\.\d{1})?|0\.\d{1})$/, "Must be a number"),
    activeStatus: z.string().min(1, "Required").refine(value => value != "true" || "false", "This value must be a boolean"),
    orgId: z.string().min(1, "Required")
})

export const createItemSchema = z.object({
    summary: z.string().min(1, "Required"),
    description: z.string().min(1, "Required"),
    name: z.string().min(1, "Required"),
    donationGoalValue: z.string().min(1, "Required").regex(/^(0|[1-9]\d*(\.\d{1})?|0\.\d{1})$/, "Must be a number"),
    totalDonationValue: z.string().min(1, "Required").regex(/^(0|[1-9]\d*(\.\d{1})?|0\.\d{1})$/, "Must be a number"),
    activeStatus: z.string().min(1, "Required").refine(value => value != "true" || "false", "This value must be a boolean"),
    orgId: z.string().min(1, "Required")
})

export const itemImageSchema = z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.string(),
    buffer: z.any(),
    size: z.number()
})

export const editItemImageSchema = z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.string(),
    buffer: z.any(),
    size: z.number()
}).optional()

const requiredNumericString = z.string().min(1, "Required").regex(/^(0|[1-9]\d*(\.\d{1})?|0\.\d{1})$/, "Must be a number")
const requiredString = z.string().min(1, "Required")
const requiredBooleanString = z.string().min(1, "Required").refine(value => value != "true" || "false", "This value must be a boolean")

export type CreateItemSchema = z.infer<typeof createItemSchema>

const contactSchema = z.object({
    email: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
}).refine((data) => data.email || data.phone, {
    message: "Email or url is required",
    path: ["email"],
});


export const createDonationSchema = z.object({
    payment_intent: requiredString,
    amount: requiredNumericString,
    orgId: requiredString,
    comment: requiredString,
    donorName: z.string().optional(),
    itemId: z.string().optional(),
}).and(contactSchema)

export type CreateDonationSchema = z.infer<typeof createDonationSchema>

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];


export const createOrganisationSchema = z.object({
    ABN: requiredNumericString,
    activeStatus: requiredBooleanString,
    description: requiredString,
    name: requiredString,
    phone: requiredNumericString,
    summary: requiredString,
    website: requiredString,
    totalDonationsCount: requiredNumericString,
    totalDonationItemsCount: requiredNumericString,
    totalDonationsValue: requiredNumericString,
})

export const createOrganisationImageSchema = z.object({
    image: z.array(z.any()
        .refine((file) => file.size < 2 * 1024 * 1024, 'File size must be less than 2MB'),
    )
        .min(1, 'At least 1 file is required').refine(
            (files) => files.every((file) => ACCEPTED_IMAGE_TYPES.includes(file.type)),
            "Only .jpg, .jpeg, .png and .webp formats are supported."
        )
        .refine(
            (files) => files.every((file) => file.size <= MAX_FILE_SIZE), `Max image size is 5MB.`
        ),
})

export const editOrganisationImageSchema = z.object({
    image: z.array(z.any()
        .refine((file) => file.size < 2 * 1024 * 1024, 'File size must be less than 2MB'),
    )
        .min(1, 'At least 1 file is required').refine(
            (files) => files.every((file) => ACCEPTED_IMAGE_TYPES.includes(file.type)),
            "Only .jpg, .jpeg, .png and .webp formats are supported."
        )
        .refine(
            (files) => files.every((file) => file.size <= MAX_FILE_SIZE), `Max image size is 5MB.`
        ),
})

export const editOrganisationSchema = z.object({
    ABN: requiredNumericString,
    activeStatus: requiredBooleanString,
    description: requiredString,
    name: requiredString,
    phone: requiredNumericString,
    summary: requiredString,
    website: requiredString,
    totalDonationsCount: requiredNumericString,
    totalDonationItemsCount: requiredNumericString,
    totalDonationsValue: requiredNumericString,
    previousImages: z.array(requiredString),
})