import Stripe from "stripe";
import { envSanitisedSchema } from "./validation";

const stripe = new Stripe(envSanitisedSchema.STRIPE_SECRET_KEY);

export default stripe;