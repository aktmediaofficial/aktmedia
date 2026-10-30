import { Router, type IRouter } from "express";
import audioRouter from "./audio";
import healthRouter from "./health";
import playlistsRouter from "./playlists";

const router: IRouter = Router();

router.use(healthRouter);
router.use(audioRouter);
router.use(playlistsRouter);

export default router;
