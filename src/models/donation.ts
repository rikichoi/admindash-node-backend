import { model, Schema } from "mongoose";

type Donation = {
    refundStatus: boolean;
    amount: number;
    comment: string;
    donorName?: string;
    // TODO: append orgId to donation controller and this model and schema
    orgId: string;
    itemId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const DonationSchema = new Schema({
    refundStatus: { type: Boolean, required: false, default: false },
    amount: { type: Number, required: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    comment: { type: String, required: true },
    donorName: { type: String, required: false },
    email: { type: String, required: false },
    phone: { type: Number, required: false },
    itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: false },
    // orgId: { type: String, required: true },
    // organisations: [{ type: Schema.Types.ObjectId, ref: 'Organisation' }],
}, { timestamps: true });

export default model<Donation>("Donation", DonationSchema);