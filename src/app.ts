import 'dotenv/config'
import express, { NextFunction, Request, Response } from "express";
import authRoutes from "./routes/authRoutes";
import itemRoutes from "./routes/itemRoutes";
import donationRoutes from "./routes/donationRoutes";
import organisationRoutes from "./routes/organisationRoutes";
import createHttpError, { isHttpError } from 'http-errors';
import cors from "cors";

const app = express();
const corsOptions = {
    origin: 'https://3.128.24.35',
    credentials: true,            //access-control-allow-credentials:true
    optionSuccessStatus: 200
}


app.use(express.json());

app.use(cors(corsOptions));

app.use("/api/auth", authRoutes)

app.use("/api/item", itemRoutes)

app.use("/api/donation", donationRoutes)

app.use("/api/organisation", organisationRoutes)

app.use((req, res, next) => {
    next(createHttpError(404, "Endpoint not found"))
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error(error)
    let errorMessage = "An unknown error occured";
    let statusCode = 500;
    if (isHttpError(error)) {
        statusCode = error.status;
        errorMessage = error.message;
    }
    res.status(statusCode).json({ error: errorMessage })
})

export default app;