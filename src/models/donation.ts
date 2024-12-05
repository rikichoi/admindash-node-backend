import { model, Schema } from "mongoose";

type Donation = {
    refundStatus: boolean;
    amount: number;
    comment: string;
    donorName?: string;
    orgId: string;
    itemId?: string;
    stripePaymentIntentId: string;
    createdAt: Date;
    updatedAt: Date;
}

const DonationSchema = new Schema({
    stripePaymentIntentId: { type: String, required: true },
    refundStatus: { type: Boolean, required: false, default: false },
    amount: { type: Number, required: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    comment: { type: String, required: true },
    donorName: { type: String, required: false },
    email: { type: String, required: false },
    phone: { type: Number, required: false },
    itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: false },
}, { timestamps: true });

export default model<Donation>("Donation", DonationSchema);