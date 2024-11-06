import express from "express";
import * as OrganisationController from "../controllers/organisationController"
import multer from "multer"

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
const router = express.Router();

router.post("/create-organisation", upload.array("image"), OrganisationController.createOrganisation);

router.get("/get-organisations", OrganisationController.getOrganisations)

router.delete("/delete-organisation/:orgId", OrganisationController.deleteOrganisation)

router.patch("/edit-organisation/:orgId", upload.array("newImages"), OrganisationController.editOrganisation)

export default router;