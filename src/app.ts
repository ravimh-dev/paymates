import "dotenv/config";
import "express-async-errors";
import express, { Application } from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRouter from "../modules/auth/auth.route";
import userRouter from "../modules/user/user.route";
import groupRouter from "../modules/groups/groups.route";
import expenseRouter from "../modules/expenses/expenses.route";
import settlementRouter from "../modules/settlements/settlements.route";
import notificationRouter from "../modules/notifications/notifications.route";

import { notFound, errorHandler } from "../middlewares/error.middleware";

const app: Application = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "fonts.googleapis.com",
          "cdnjs.cloudflare.com",
        ],
        fontSrc: ["'self'", "fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  }),
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
  max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many auth attempts, please try again later",
  },
});

app.use("/api", limiter);
app.use("/api/auth", authLimiter);

// ─── Parsers ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(compression());

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── View engine (EJS) ────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(express.static(path.join(__dirname, "..", "public")));

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/groups", groupRouter);
app.use("/api/expenses", expenseRouter);
app.use("/api/settlements", settlementRouter);
app.use("/api/notifications", notificationRouter);

// ─── EJS view routes ─────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.redirect("/login"));
app.get("/login", (_req, res) => res.render("pages/login", { title: "Login" }));
app.get("/dashboard", (_req, res) =>
  res.render("pages/dashboard", { title: "Dashboard" }),
);
app.get("/profile", (_req, res) =>
  res.render("pages/profile", { title: "Profile" }),
);
app.get("/groups", (_req, res) =>
  res.render("pages/groups", { title: "Groups" }),
);
app.get("/balances", (_req, res) =>
  res.render("pages/balances", { title: "Balances" }),
);
app.get("/history", (_req, res) =>
  res.render("pages/history", { title: "History" }),
);
app.get("/settlements", (_req, res) =>
  res.render("pages/settlement", { title: "Settlements", groupId: "" }),
);
app.get("/groups/create", (_req, res) =>
  res.render("pages/create-group", { title: "Create Group" }),
);
app.get("/expenses", (_req, res) =>
  res.render("pages/expense", { title: "Expenses" }),
);
app.get("/notifications", (_req, res) =>
  res.render("pages/notifications", { title: "Notifications" }),
);
app.get("/groups/:id", (_req, res) =>
  res.render("pages/group", { title: "Group", groupId: _req.params.id }),
);
app.get("/settlements/:groupId", (_req, res) =>
  res.render("pages/settlement", {
    title: "Settlements",
    groupId: _req.params.groupId,
  }),
);
app.get("/join/:token", (_req, res) =>
  res.render("pages/join", {
    title: "Join Group",
    inviteToken: _req.params.token,
  }),
);
app.get("/reset-password", (_req, res) =>
  res.render("pages/reset-password", { title: "Reset Password" }),
);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
