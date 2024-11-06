// import { RequestHandler } from "express";
// import User from "../models/user";
// import { createUserSchema, updateUserSchema } from "../lib/validation";
// import { ZodError } from "zod";
// import createHttpError from "http-errors";
// import mongoose from "mongoose";

// // TODO: Learn how to gracefully handle errors; especially the updateUser controller

// export const getUsers: RequestHandler = async (req, res, next) => {
//     try {
//         // throw Error("There was an error!!!!")
//         const users = await User.find().exec();
//         res.status(200).json(users);
//     } catch (error) {
//         next(error);
//     }
// }

// export const getUser: RequestHandler = async (req, res, next) => {
//     const userId = req.params.userId;
//     try {
//         if (!mongoose.isValidObjectId(userId)) {
//             throw createHttpError(400, "Invalid userId")
//         }

//         const user = await User.findById(userId).exec();

//         if (!user) {
//             throw createHttpError(404, "User not found")
//         }

//         res.status(200).json(user);
//     }
//     catch (error) {
//         next(error)
//     }
// }

// export const deleteUser: RequestHandler = async (req, res, next) => {
//     const userId = req.params.userId;

//     try {
//         await User.deleteOne({ _id: userId }).exec();

//         res.status(200).json(`User: ${userId} was successfully deleted`)
//     }
//     catch (error) {
//         next(error)
//     }
// }

// export const createUser: RequestHandler = async (req, res, next) => {
//     const data = createUserSchema.parse(req.body)

//     try {

//         const newUser = await User.create({
//             email: data.email,
//             username: data.username,
//             passwordHashed: data.passwordHashed,
//         });

//         res.status(201).json(newUser);
//     } catch (error) {
//         if (error instanceof ZodError) {
//             const errorMessages = error.errors.map((issue) => ({
//                 message: `${issue.path.join('.')} is ${issue.message}`,
//             }))
//             throw createHttpError(400, { error: 'Invalid data', details: errorMessages });
//         }
//         else {
//             next(error);
//         }
//     }
// };

// export const updateUser: RequestHandler = async (req, res, next) => {
//     const userId = req.params.userId;


//     try {
//         const data = await updateUserSchema.safeParseAsync(req.body);

//         if (!mongoose.isValidObjectId(userId)) {
//             throw createHttpError(400, "Invalid userId")
//         }
//         const user = await User.findOne({ _id: userId });

//         if (!user) {
//             throw createHttpError(404, "User not found")
//         }

//         if (data.success) {
//             user.username = (data.data.username || user.username);
//             user.email = (data.data.email || user.email);
//             user.passwordHashed = (data.data.passwordHashed || user.passwordHashed);
//             const updatedUser = await user.save();
//             res.status(200).json(updatedUser)
//         } else {
//             throw createHttpError(400, `'Invalid data', details: ${data.error.message}`);
//         }
//     }
//     catch (error) {
//         if (error instanceof ZodError) {
//             throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
//         }
//         else {
//             next(error)
//         }
//     }

// }