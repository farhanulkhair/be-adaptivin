import express from "express"
import { registerUser, loginUser, logoutUser } from "../controllers/authController.js"

const router = express.Router()

router.post("/register", registerUser) // hanya admin nanti yang bisa
router.post("/login", loginUser)
router.post("/logout", logoutUser)

export default router
