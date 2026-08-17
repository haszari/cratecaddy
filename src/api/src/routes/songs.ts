import { Router } from 'express';
import { songController } from '../controllers/songController.js';

const router = Router();

router.get('/', (req, res) => songController.getAllSongs(req, res));
router.get('/stats/genres', (req, res) => songController.getGenreStats(req, res));
router.get('/:id', (req, res) => songController.getSongById(req, res));
router.get('/:id/history', (req, res) => songController.getHistory(req, res));
router.post('/', (req, res) => songController.createSong(req, res));
router.put('/:id', (req, res) => songController.updateSong(req, res));
router.put('/metadata/batch', (req, res) => songController.updateMetadataBatch(req, res));
router.put('/:id/metadata', (req, res) => songController.updateMetadata(req, res));
router.post('/write-to-apple-music', (req, res) => songController.writeToAppleMusicBatch(req, res));
router.post('/write-to-apple-music/:id', (req, res) => songController.writeToAppleMusic(req, res));
router.post('/reimport-favourites-from-apple-music', (req, res) => songController.reimportFavouritesFromAppleMusic(req, res));
router.delete('/:id', (req, res) => songController.deleteSong(req, res));

export default router;
