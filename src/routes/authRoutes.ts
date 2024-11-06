import express from "express";
import * as AuthController from "../controllers/authController"

const router = express.Router();

router.post("/register", AuthController.registerUser);

router.post("/login", AuthController.loginUser);

export default router;