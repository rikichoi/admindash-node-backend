import express from "express";
import * as ItemController from "../controllers/itemController"
import multer from "multer"

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
const router = express.Router();

upload.single("itemImage")

router.post("/create-item", upload.single("itemImage"), ItemController.createItem);

router.get("/get-org-items/:orgId", ItemController.getOrgItems)

router.get("/get-items", ItemController.getItems)

router.patch("/edit-item/:itemId", upload.single("itemImage"), ItemController.editItem)

router.delete("/delete-item/:itemId", ItemController.deleteItem)

export default router;