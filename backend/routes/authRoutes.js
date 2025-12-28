import express from 'express'
import userService from '../services/userService.js'

const router = express.Router()

// POST /api/auth/login - Giriş yap
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Kullanıcı adı ve şifre gerekli'
            })
        }

        const result = await userService.login(username, password)

        if (result.success) {
            res.json(result)
        } else {
            res.status(401).json(result)
        }
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ success: false, error: 'Sunucu hatası' })
    }
})

// GET /api/auth/users - Tüm kullanıcıları getir (admin)
router.get('/users', async (req, res) => {
    try {
        const result = await userService.getAllUsers()
        res.json(result)
    } catch (error) {
        console.error('Users error:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// POST /api/auth/users - Yeni kullanıcı ekle
router.post('/users', async (req, res) => {
    try {
        const result = await userService.createUser(req.body)
        res.json(result)
    } catch (error) {
        console.error('Create user error:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// PUT /api/auth/users/:id - Kullanıcı güncelle
router.put('/users/:id', async (req, res) => {
    try {
        const result = await userService.updateUser(req.params.id, req.body)
        res.json(result)
    } catch (error) {
        console.error('Update user error:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// PUT /api/auth/users/:id/password - Şifre değiştir
router.put('/users/:id/password', async (req, res) => {
    try {
        const result = await userService.changePassword(req.params.id, req.body.password)
        res.json(result)
    } catch (error) {
        console.error('Change password error:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// DELETE /api/auth/users/:id - Kullanıcı sil
router.delete('/users/:id', async (req, res) => {
    try {
        const result = await userService.deleteUser(req.params.id)
        if (!result.success) {
            return res.status(400).json(result)
        }
        res.json(result)
    } catch (error) {
        console.error('Delete user error:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

export default router

