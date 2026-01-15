import { Router } from 'express';
import { songController } from '../controllers/songController.js';

const router = Router();

router.get('/', (req, res) => songController.getAllSongs(req, res));
router.get('/stats/genres', (req, res) => songController.getGenreStats(req, res));
router.get('/:id', (req, res) => songController.getSongById(req, res));
router.post('/', (req, res) => songController.createSong(req, res));
router.put('/:id', (req, res) => songController.updateSong(req, res));
router.delete('/:id', (req, res) => songController.deleteSong(req, res));

export default router;
