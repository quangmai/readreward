import { useState, useRef, useEffect } from "react";
import "./readreward.css";
import {
  supabase,
  signUpParent, logInParent, logOut, onAuthStateChange, resetPassword,
  getParentProfile,
  getChildren as fetchChildren, addChild as addChildToDb, updateChild as updateChildInDb,
  hashPin, verifyChildPin,
  getRewardConfigs, getDifficultyBonuses,
  getAllBooks, getAllReadingLogs,
  addBook as addBookToDb, updateBook as updateBookInDb,
  addReadingLog as addLogToDb,
  approveLog as approveLogInDb, rejectLog as rejectLogInDb,
  uploadCover,
  upsertRewardConfig, deleteRewardConfig, upsertDifficultyBonus,
  getAllRedemptions, addRedemption as addRedemptionToDb,
  approveRedemption as approveRedemptionInDb, rejectRedemption as rejectRedemptionInDb,
  getAllAchievements, addAchievement as addAchievementToDb,
  subscribeToPush, savePushSubscription, getPushPermission, sendPushNotification,
} from "./supabase";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
// Default rewards — moved to state inside App so parents can edit them
const DEFAULT_REWARDS = [
  { id:"game",  label:"Game Time",    icon:"🎮", unit:"mins", rate:2, color:"#FF6B35" },
  { id:"watch", label:"Watch Time",   icon:"📺", unit:"mins", rate:3, color:"#9B59B6" },
  { id:"money", label:"Pocket Money", icon:"💰", unit:"p",    rate:5, color:"#27AE60" },
];
// bonusType: "percent" | "absolute"   bonusValue: number applied on top of base rate
const DEFAULT_DIFFICULTY_BONUSES = {
  easy:   { bonusType:"percent",  bonusValue:0  },
  medium: { bonusType:"percent",  bonusValue:50 },
  hard:   { bonusType:"percent",  bonusValue:100},
};
const DIFFICULTY_LABELS = { easy:"😊 Easy", medium:"🤔 Medium", hard:"🧠 Hard" };
const BADGES = [
  { id:"first_session",  icon:"📖",  label:"First Steps",     desc:"Log your first reading session",   check:(s)=>s.totalSessions>=1 },
  { id:"first_book",     icon:"🌟",  label:"Bookworm",        desc:"Finish your first book",           check:(s)=>s.booksCompleted>=1 },
  { id:"streak_7",       icon:"🔥",  label:"On Fire",         desc:"7-day reading streak",             check:(s)=>s.longestStreak>=7 },
  { id:"streak_30",      icon:"⚡",  label:"Unstoppable",     desc:"30-day reading streak",            check:(s)=>s.longestStreak>=30 },
  { id:"pages_100",      icon:"📚",  label:"Page Turner",     desc:"Read 100 pages total",             check:(s)=>s.totalPages>=100 },
  { id:"pages_500",      icon:"🏆",  label:"Half K",          desc:"Read 500 pages total",             check:(s)=>s.totalPages>=500 },
  { id:"pages_1000",     icon:"👑",  label:"Page King",       desc:"Read 1,000 pages total",           check:(s)=>s.totalPages>=1000 },
  { id:"pages_2000",     icon:"🚀",  label:"Rocket Reader",   desc:"Read 2,000 pages total",           check:(s)=>s.totalPages>=2000 },
  { id:"books_5",        icon:"📚",  label:"Library Builder", desc:"Finish 5 books",                   check:(s)=>s.booksCompleted>=5 },
  { id:"books_10",       icon:"🎓",  label:"Scholar",         desc:"Finish 10 books",                  check:(s)=>s.booksCompleted>=10 },
  { id:"sessions_10",    icon:"🎯",  label:"Sharpshooter",    desc:"10 approved sessions",             check:(s)=>s.approvedSessions>=10 },
  { id:"sessions_50",    icon:"💫",  label:"Legend",          desc:"50 approved sessions",             check:(s)=>s.approvedSessions>=50 },
];
const REWARD_COLORS = ["#FF6B35","#9B59B6","#27AE60","#3B82F6","#EC4899","#F59E0B","#06B6D4","#8B5CF6"];
const REWARD_ICONS  = ["🎮","📺","💰","🎨","🎵","🍕","⚽","📱","🎪","🏊"];
const MAX_BOOKS   = 3;
const AVATAR_COLORS = [
  ["#FF6B35","#FFD166"],["#8E54E9","#C084FC"],["#10B981","#6EE7B7"],
  ["#3B82F6","#93C5FD"],["#EC4899","#F9A8D4"],["#F59E0B","#FDE68A"],
];
const AVATAR_CHARACTERS = [
  {id:"red_suit",label:"Red Suit",src:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTYwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCI+CiAgPCEtLSBSZWQgU3VpdCBCb3kgLS0+CiAgPCEtLSBIYWlyIC0tPgogIDxyZWN0IHg9IjMwIiB5PSI4IiB3aWR0aD0iNjAiIGhlaWdodD0iMjAiIHJ4PSI0IiBmaWxsPSIjQzAzOTJCIi8+CiAgPHJlY3QgeD0iMjgiIHk9IjE4IiB3aWR0aD0iNjQiIGhlaWdodD0iMTAiIHJ4PSIyIiBmaWxsPSIjQzAzOTJCIi8+CiAgPCEtLSBIZWFkIC0tPgogIDxyZWN0IHg9IjMyIiB5PSIyNCIgd2lkdGg9IjU2IiBoZWlnaHQ9IjUwIiByeD0iNiIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gRXllcyAtLT4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjQ2IiByPSI0IiBmaWxsPSIjMkMzRTUwIi8+CiAgPGNpcmNsZSBjeD0iNzIiIGN5PSI0NiIgcj0iNCIgZmlsbD0iIzJDM0U1MCIvPgogIDxjaXJjbGUgY3g9IjQ5IiBjeT0iNDUiIHI9IjEuNSIgZmlsbD0id2hpdGUiLz4KICA8Y2lyY2xlIGN4PSI3MyIgY3k9IjQ1IiByPSIxLjUiIGZpbGw9IndoaXRlIi8+CiAgPCEtLSBNb3V0aCAtLT4KICA8cGF0aCBkPSJNNTIgNTggUTYwIDY0IDY4IDU4IiBzdHJva2U9IiMyQzNFNTAiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPCEtLSBOZWNrIC0tPgogIDxyZWN0IHg9IjUwIiB5PSI3NCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjYiIGZpbGw9IiNGNUNCQTciLz4KICA8IS0tIFRpZSAtLT4KICA8cG9seWdvbiBwb2ludHM9IjYwLDc4IDU1LDkwIDYwLDEwMCA2NSw5MCIgZmlsbD0iIzJDM0U1MCIvPgogIDwhLS0gSmFja2V0IC0tPgogIDxyZWN0IHg9IjI0IiB5PSI3OCIgd2lkdGg9IjcyIiBoZWlnaHQ9IjQ0IiByeD0iNCIgZmlsbD0iI0U3NEMzQyIvPgogIDwhLS0gU2hpcnQgLS0+CiAgPHJlY3QgeD0iNDYiIHk9Ijc4IiB3aWR0aD0iMjgiIGhlaWdodD0iMjAiIGZpbGw9IndoaXRlIi8+CiAgPCEtLSBBcm1zIC0tPgogIDxyZWN0IHg9IjEyIiB5PSI4MCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjM2IiByeD0iNCIgZmlsbD0iI0U3NEMzQyIvPgogIDxyZWN0IHg9IjkyIiB5PSI4MCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjM2IiByeD0iNCIgZmlsbD0iI0U3NEMzQyIvPgogIDwhLS0gSGFuZHMgLS0+CiAgPHJlY3QgeD0iMTQiIHk9IjExMiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEwIiByeD0iMyIgZmlsbD0iI0Y1Q0JBNyIvPgogIDxyZWN0IHg9Ijk0IiB5PSIxMTIiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMCIgcng9IjMiIGZpbGw9IiNGNUNCQTciLz4KICA8IS0tIExlZ3MgLS0+CiAgPHJlY3QgeD0iMzQiIHk9IjEyMiIgd2lkdGg9IjIyIiBoZWlnaHQ9IjMwIiByeD0iMyIgZmlsbD0iIzJDM0U1MCIvPgogIDxyZWN0IHg9IjY0IiB5PSIxMjIiIHdpZHRoPSIyMiIgaGVpZ2h0PSIzMCIgcng9IjMiIGZpbGw9IiMyQzNFNTAiLz4KICA8IS0tIFNob2VzIC0tPgogIDxyZWN0IHg9IjMyIiB5PSIxNDgiIHdpZHRoPSIyNiIgaGVpZ2h0PSIxMCIgcng9IjQiIGZpbGw9IiMxQTFBMkUiLz4KICA8cmVjdCB4PSI2MiIgeT0iMTQ4IiB3aWR0aD0iMjYiIGhlaWdodD0iMTAiIHJ4PSI0IiBmaWxsPSIjMUExQTJFIi8+Cjwvc3ZnPgo="},
  {id:"school_girl",label:"School Girl",src:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTYwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCI+CiAgPCEtLSBTY2hvb2wgR2lybCAtLT4KICA8IS0tIEhhaXIgYmFjayAtLT4KICA8cmVjdCB4PSIyNiIgeT0iMTAiIHdpZHRoPSI2OCIgaGVpZ2h0PSI2NSIgcng9IjYiIGZpbGw9IiMxQTFBMkUiLz4KICA8IS0tIEhlYWQgLS0+CiAgPHJlY3QgeD0iMzIiIHk9IjI0IiB3aWR0aD0iNTYiIGhlaWdodD0iNTAiIHJ4PSI2IiBmaWxsPSIjRjVDQkE3Ii8+CiAgPCEtLSBIYWlyIGZyb250L2JhbmdzIC0tPgogIDxyZWN0IHg9IjMwIiB5PSIxMCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjE4IiByeD0iNCIgZmlsbD0iIzFBMUEyRSIvPgogIDxyZWN0IHg9IjI4IiB5PSIxOCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjMwIiByeD0iMiIgZmlsbD0iIzFBMUEyRSIvPgogIDxyZWN0IHg9IjcyIiB5PSIxOCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjMwIiByeD0iMiIgZmlsbD0iIzFBMUEyRSIvPgogIDwhLS0gRXllcyAtLT4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjQ2IiByPSI0IiBmaWxsPSIjMkMzRTUwIi8+CiAgPGNpcmNsZSBjeD0iNzIiIGN5PSI0NiIgcj0iNCIgZmlsbD0iIzJDM0U1MCIvPgogIDxjaXJjbGUgY3g9IjQ5IiBjeT0iNDUiIHI9IjEuNSIgZmlsbD0id2hpdGUiLz4KICA8Y2lyY2xlIGN4PSI3MyIgY3k9IjQ1IiByPSIxLjUiIGZpbGw9IndoaXRlIi8+CiAgPCEtLSBNb3V0aCAoc2xpZ2h0IGZyb3duKSAtLT4KICA8cGF0aCBkPSJNNTIgNjAgUTYwIDU2IDY4IDYwIiBzdHJva2U9IiMyQzNFNTAiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPCEtLSBOZWNrIC0tPgogIDxyZWN0IHg9IjUwIiB5PSI3NCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjYiIGZpbGw9IiNGNUNCQTciLz4KICA8IS0tIEJsYXplciAtLT4KICA8cmVjdCB4PSIyNCIgeT0iNzgiIHdpZHRoPSI3MiIgaGVpZ2h0PSI0MCIgcng9IjQiIGZpbGw9IiMzNDQ5NUUiLz4KICA8IS0tIENvbGxhciAtLT4KICA8cG9seWdvbiBwb2ludHM9IjQ2LDc4IDYwLDkyIDc0LDc4IiBmaWxsPSJ3aGl0ZSIvPgogIDxwb2x5Z29uIHBvaW50cz0iNTAsNzggNjAsODggNzAsNzgiIGZpbGw9IiNFNzRDM0MiLz4KICA8IS0tIEFybXMgLS0+CiAgPHJlY3QgeD0iMTIiIHk9IjgwIiB3aWR0aD0iMTYiIGhlaWdodD0iMzQiIHJ4PSI0IiBmaWxsPSIjMzQ0OTVFIi8+CiAgPHJlY3QgeD0iOTIiIHk9IjgwIiB3aWR0aD0iMTYiIGhlaWdodD0iMzQiIHJ4PSI0IiBmaWxsPSIjMzQ0OTVFIi8+CiAgPCEtLSBIYW5kcyAtLT4KICA8cmVjdCB4PSIxNCIgeT0iMTEwIiB3aWR0aD0iMTIiIGhlaWdodD0iMTAiIHJ4PSIzIiBmaWxsPSIjRjVDQkE3Ii8+CiAgPHJlY3QgeD0iOTQiIHk9IjExMCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEwIiByeD0iMyIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gU2tpcnQgLS0+CiAgPHBhdGggZD0iTTI4IDExOCBMMjQgMTQ4IEw5NiAxNDggTDkyIDExOCBaIiBmaWxsPSIjNkMzNDgzIiByeD0iMyIvPgogIDwhLS0gTGVncyAtLT4KICA8cmVjdCB4PSI0MCIgeT0iMTQwIiB3aWR0aD0iMTQiIGhlaWdodD0iMTIiIHJ4PSIyIiBmaWxsPSIjRjVDQkE3Ii8+CiAgPHJlY3QgeD0iNjYiIHk9IjE0MCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjEyIiByeD0iMiIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gU2hvZXMgLS0+CiAgPHJlY3QgeD0iMzgiIHk9IjE0OCIgd2lkdGg9IjE4IiBoZWlnaHQ9IjEwIiByeD0iNCIgZmlsbD0iIzFBMUEyRSIvPgogIDxyZWN0IHg9IjY0IiB5PSIxNDgiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxMCIgcng9IjQiIGZpbGw9IiMxQTFBMkUiLz4KPC9zdmc+Cg=="},
  {id:"spiky_boy",label:"Spiky Boy",src:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTYwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCI+CiAgPCEtLSBTcGlreSBCb3kgLS0+CiAgPCEtLSBTcGlreSBIYWlyIC0tPgogIDxwb2x5Z29uIHBvaW50cz0iNDAsMjQgMzUsNiA0OCwxOCA1MCwyIDU4LDE2IDYyLDAgNjgsMTYgNzIsNCA3OCwxOCA4NSw4IDgyLDI0IiBmaWxsPSIjRjREMDNGIi8+CiAgPHJlY3QgeD0iMzQiIHk9IjE2IiB3aWR0aD0iNTIiIGhlaWdodD0iMTIiIHJ4PSIyIiBmaWxsPSIjRjREMDNGIi8+CiAgPCEtLSBIZWFkIC0tPgogIDxyZWN0IHg9IjMyIiB5PSIyNCIgd2lkdGg9IjU2IiBoZWlnaHQ9IjUwIiByeD0iNiIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gRXllcyAtLT4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjQ2IiByPSI0IiBmaWxsPSIjMkMzRTUwIi8+CiAgPGNpcmNsZSBjeD0iNzIiIGN5PSI0NiIgcj0iNCIgZmlsbD0iIzJDM0U1MCIvPgogIDxjaXJjbGUgY3g9IjQ5IiBjeT0iNDUiIHI9IjEuNSIgZmlsbD0id2hpdGUiLz4KICA8Y2lyY2xlIGN4PSI3MyIgY3k9IjQ1IiByPSIxLjUiIGZpbGw9IndoaXRlIi8+CiAgPCEtLSBNb3V0aCAtLT4KICA8cmVjdCB4PSI1MCIgeT0iNTgiIHdpZHRoPSIyMCIgaGVpZ2h0PSIzIiByeD0iMS41IiBmaWxsPSIjMkMzRTUwIi8+CiAgPCEtLSBOZWNrIC0tPgogIDxyZWN0IHg9IjUwIiB5PSI3NCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjYiIGZpbGw9IiNGNUNCQTciLz4KICA8IS0tIFQtc2hpcnQgLS0+CiAgPHJlY3QgeD0iMjQiIHk9Ijc4IiB3aWR0aD0iNzIiIGhlaWdodD0iNDIiIHJ4PSI0IiBmaWxsPSIjMzQ5OERCIi8+CiAgPCEtLSBTaGlydCBkZXRhaWwgLS0+CiAgPHJlY3QgeD0iNDgiIHk9Ijg4IiB3aWR0aD0iMjQiIGhlaWdodD0iMyIgcng9IjEiIGZpbGw9IiMyOTgwQjkiLz4KICA8IS0tIEFybXMgLS0+CiAgPHJlY3QgeD0iMTIiIHk9IjgwIiB3aWR0aD0iMTYiIGhlaWdodD0iMzQiIHJ4PSI0IiBmaWxsPSIjMzQ5OERCIi8+CiAgPHJlY3QgeD0iOTIiIHk9IjgwIiB3aWR0aD0iMTYiIGhlaWdodD0iMzQiIHJ4PSI0IiBmaWxsPSIjMzQ5OERCIi8+CiAgPCEtLSBIYW5kcyAtLT4KICA8cmVjdCB4PSIxNCIgeT0iMTEwIiB3aWR0aD0iMTIiIGhlaWdodD0iMTAiIHJ4PSIzIiBmaWxsPSIjRjVDQkE3Ii8+CiAgPHJlY3QgeD0iOTQiIHk9IjExMCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEwIiByeD0iMyIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gUGFudHMgLS0+CiAgPHJlY3QgeD0iMzAiIHk9IjEyMCIgd2lkdGg9IjI2IiBoZWlnaHQ9IjMyIiByeD0iMyIgZmlsbD0iIzJDM0U1MCIvPgogIDxyZWN0IHg9IjY0IiB5PSIxMjAiIHdpZHRoPSIyNiIgaGVpZ2h0PSIzMiIgcng9IjMiIGZpbGw9IiMyQzNFNTAiLz4KICA8IS0tIFNob2VzIC0tPgogIDxyZWN0IHg9IjI4IiB5PSIxNDgiIHdpZHRoPSIzMCIgaGVpZ2h0PSIxMCIgcng9IjQiIGZpbGw9IiNFNzRDM0MiLz4KICA8cmVjdCB4PSI2MiIgeT0iMTQ4IiB3aWR0aD0iMzAiIGhlaWdodD0iMTAiIHJ4PSI0IiBmaWxsPSIjRTc0QzNDIi8+Cjwvc3ZnPgo="},
  {id:"happy_buns",label:"Happy Buns",src:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTYwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCI+CiAgPCEtLSBIYXBweSBCdW5zIEdpcmwgLS0+CiAgPCEtLSBIYWlyIGJ1bnMgLS0+CiAgPGNpcmNsZSBjeD0iMzIiIGN5PSIxNiIgcj0iMTQiIGZpbGw9IiMxQTFBMkUiLz4KICA8Y2lyY2xlIGN4PSI4OCIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzFBMUEyRSIvPgogIDwhLS0gSGFpciAtLT4KICA8cmVjdCB4PSIzMCIgeT0iMTIiIHdpZHRoPSI2MCIgaGVpZ2h0PSIyMCIgcng9IjQiIGZpbGw9IiMxQTFBMkUiLz4KICA8IS0tIEhlYWQgLS0+CiAgPHJlY3QgeD0iMzIiIHk9IjI0IiB3aWR0aD0iNTYiIGhlaWdodD0iNTAiIHJ4PSI2IiBmaWxsPSIjRjVDQkE3Ii8+CiAgPCEtLSBCYW5ncyAtLT4KICA8cmVjdCB4PSIzNCIgeT0iMTQiIHdpZHRoPSI1MiIgaGVpZ2h0PSIxNCIgcng9IjMiIGZpbGw9IiMxQTFBMkUiLz4KICA8IS0tIEV5ZXMgKGhhcHB5IGNsb3NlZCkgLS0+CiAgPHBhdGggZD0iTTQyIDQ0IFE0OCA0MCA1NCA0NCIgc3Ryb2tlPSIjMkMzRTUwIiBzdHJva2Utd2lkdGg9IjIuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTY2IDQ0IFE3MiA0MCA3OCA0NCIgc3Ryb2tlPSIjMkMzRTUwIiBzdHJva2Utd2lkdGg9IjIuNSIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPCEtLSBCbHVzaCAtLT4KICA8Y2lyY2xlIGN4PSI0MiIgY3k9IjUyIiByPSI1IiBmaWxsPSIjRkFEQkQ4IiBvcGFjaXR5PSIwLjciLz4KICA8Y2lyY2xlIGN4PSI3OCIgY3k9IjUyIiByPSI1IiBmaWxsPSIjRkFEQkQ4IiBvcGFjaXR5PSIwLjciLz4KICA8IS0tIE1vdXRoIChiaWcgaGFwcHkpIC0tPgogIDxwYXRoIGQ9Ik00OCA1NiBRNjAgNjggNzIgNTYiIHN0cm9rZT0iIzJDM0U1MCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8IS0tIE5lY2sgLS0+CiAgPHJlY3QgeD0iNTAiIHk9Ijc0IiB3aWR0aD0iMjAiIGhlaWdodD0iNiIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gRHJlc3MgLS0+CiAgPHJlY3QgeD0iMjQiIHk9Ijc4IiB3aWR0aD0iNzIiIGhlaWdodD0iMzAiIHJ4PSI0IiBmaWxsPSIjRTc0QzNDIi8+CiAgPHBhdGggZD0iTTI0IDEwOCBMMTggMTQ4IEwxMDIgMTQ4IEw5NiAxMDggWiIgZmlsbD0iI0U3NEMzQyIvPgogIDwhLS0gQXJtcyAtLT4KICA8cmVjdCB4PSIxMCIgeT0iODAiIHdpZHRoPSIxNiIgaGVpZ2h0PSIzMCIgcng9IjQiIGZpbGw9IiNFNzRDM0MiLz4KICA8cmVjdCB4PSI5NCIgeT0iODAiIHdpZHRoPSIxNiIgaGVpZ2h0PSIzMCIgcng9IjQiIGZpbGw9IiNFNzRDM0MiLz4KICA8IS0tIEhhbmRzIC0tPgogIDxyZWN0IHg9IjEyIiB5PSIxMDYiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMCIgcng9IjMiIGZpbGw9IiNGNUNCQTciLz4KICA8cmVjdCB4PSI5NiIgeT0iMTA2IiB3aWR0aD0iMTIiIGhlaWdodD0iMTAiIHJ4PSIzIiBmaWxsPSIjRjVDQkE3Ii8+CiAgPCEtLSBMZWdzIC0tPgogIDxyZWN0IHg9IjQyIiB5PSIxNDAiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgcng9IjIiIGZpbGw9IiNGNUNCQTciLz4KICA8cmVjdCB4PSI2NiIgeT0iMTQwIiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiBmaWxsPSIjRjVDQkE3Ii8+CiAgPCEtLSBTaG9lcyAtLT4KICA8cmVjdCB4PSIzOCIgeT0iMTQ4IiB3aWR0aD0iMTgiIGhlaWdodD0iMTAiIHJ4PSI0IiBmaWxsPSIjOTIyQjIxIi8+CiAgPHJlY3QgeD0iNjQiIHk9IjE0OCIgd2lkdGg9IjE4IiBoZWlnaHQ9IjEwIiByeD0iNCIgZmlsbD0iIzkyMkIyMSIvPgo8L3N2Zz4K"},
  {id:"glasses_girl",label:"Glasses Girl",src:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTYwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCI+CiAgPCEtLSBHbGFzc2VzIEdpcmwgLS0+CiAgPCEtLSBQaWd0YWlscyAtLT4KICA8Y2lyY2xlIGN4PSIyMiIgY3k9IjI4IiByPSIxMiIgZmlsbD0iI0Y0RDAzRiIvPgogIDxjaXJjbGUgY3g9Ijk4IiBjeT0iMjgiIHI9IjEyIiBmaWxsPSIjRjREMDNGIi8+CiAgPCEtLSBIYWlyIC0tPgogIDxyZWN0IHg9IjMwIiB5PSI4IiB3aWR0aD0iNjAiIGhlaWdodD0iMjIiIHJ4PSI0IiBmaWxsPSIjRjREMDNGIi8+CiAgPHJlY3QgeD0iMjYiIHk9IjE2IiB3aWR0aD0iNjgiIGhlaWdodD0iMTQiIHJ4PSIzIiBmaWxsPSIjRjREMDNGIi8+CiAgPCEtLSBIZWFkIC0tPgogIDxyZWN0IHg9IjMyIiB5PSIyNCIgd2lkdGg9IjU2IiBoZWlnaHQ9IjUwIiByeD0iNiIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gR2xhc3NlcyBmcmFtZSAtLT4KICA8cmVjdCB4PSIzOCIgeT0iMzgiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxNiIgcng9IjMiIHN0cm9rZT0iI0MwMzkyQiIgc3Ryb2tlLXdpZHRoPSIyLjUiIGZpbGw9Im5vbmUiLz4KICA8cmVjdCB4PSI2NCIgeT0iMzgiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxNiIgcng9IjMiIHN0cm9rZT0iI0MwMzkyQiIgc3Ryb2tlLXdpZHRoPSIyLjUiIGZpbGw9Im5vbmUiLz4KICA8bGluZSB4MT0iNTYiIHkxPSI0NiIgeDI9IjY0IiB5Mj0iNDYiIHN0cm9rZT0iI0MwMzkyQiIgc3Ryb2tlLXdpZHRoPSIyLjUiLz4KICA8IS0tIEV5ZXMgYmVoaW5kIGdsYXNzZXMgLS0+CiAgPGNpcmNsZSBjeD0iNDciIGN5PSI0NiIgcj0iMyIgZmlsbD0iIzJDM0U1MCIvPgogIDxjaXJjbGUgY3g9IjczIiBjeT0iNDYiIHI9IjMiIGZpbGw9IiMyQzNFNTAiLz4KICA8Y2lyY2xlIGN4PSI0OCIgY3k9IjQ1IiByPSIxLjIiIGZpbGw9IndoaXRlIi8+CiAgPGNpcmNsZSBjeD0iNzQiIGN5PSI0NSIgcj0iMS4yIiBmaWxsPSJ3aGl0ZSIvPgogIDwhLS0gTW91dGggLS0+CiAgPHBhdGggZD0iTTUyIDYwIFE2MCA2NiA2OCA2MCIgc3Ryb2tlPSIjMkMzRTUwIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDwhLS0gTmVjayAtLT4KICA8cmVjdCB4PSI1MCIgeT0iNzQiIHdpZHRoPSIyMCIgaGVpZ2h0PSI2IiBmaWxsPSIjRjVDQkE3Ii8+CiAgPCEtLSBULXNoaXJ0IC0tPgogIDxyZWN0IHg9IjI0IiB5PSI3OCIgd2lkdGg9IjcyIiBoZWlnaHQ9IjQyIiByeD0iNCIgZmlsbD0iI0U3NEMzQyIvPgogIDwhLS0gU3RhciBvbiBzaGlydCAtLT4KICA8cG9seWdvbiBwb2ludHM9IjYwLDg4IDYzLDk2IDcxLDk2IDY1LDEwMSA2NywxMDkgNjAsMTA0IDUzLDEwOSA1NSwxMDEgNDksOTYgNTcsOTYiIGZpbGw9IiNGNEQwM0YiIHRyYW5zZm9ybT0ic2NhbGUoMC42KSB0cmFuc2xhdGUoNDAsNjApIi8+CiAgPCEtLSBBcm1zIC0tPgogIDxyZWN0IHg9IjEyIiB5PSI4MCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjM0IiByeD0iNCIgZmlsbD0iI0U3NEMzQyIvPgogIDxyZWN0IHg9IjkyIiB5PSI4MCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjM0IiByeD0iNCIgZmlsbD0iI0U3NEMzQyIvPgogIDwhLS0gSGFuZHMgLS0+CiAgPHJlY3QgeD0iMTQiIHk9IjExMCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEwIiByeD0iMyIgZmlsbD0iI0Y1Q0JBNyIvPgogIDxyZWN0IHg9Ijk0IiB5PSIxMTAiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMCIgcng9IjMiIGZpbGw9IiNGNUNCQTciLz4KICA8IS0tIFBhbnRzIC0tPgogIDxyZWN0IHg9IjMwIiB5PSIxMjAiIHdpZHRoPSIyNiIgaGVpZ2h0PSIzMiIgcng9IjMiIGZpbGw9IiMzNDk4REIiLz4KICA8cmVjdCB4PSI2NCIgeT0iMTIwIiB3aWR0aD0iMjYiIGhlaWdodD0iMzIiIHJ4PSIzIiBmaWxsPSIjMzQ5OERCIi8+CiAgPCEtLSBTaG9lcyAtLT4KICA8cmVjdCB4PSIyOCIgeT0iMTQ4IiB3aWR0aD0iMzAiIGhlaWdodD0iMTAiIHJ4PSI0IiBmaWxsPSJ3aGl0ZSIvPgogIDxyZWN0IHg9IjYyIiB5PSIxNDgiIHdpZHRoPSIzMCIgaGVpZ2h0PSIxMCIgcng9IjQiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo="},
  {id:"hoodie_boy",label:"Hoodie Boy",src:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTYwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCI+CiAgPCEtLSBIb29kaWUgQm95IC0tPgogIDwhLS0gSGFpciAtLT4KICA8cmVjdCB4PSIzMCIgeT0iMTAiIHdpZHRoPSI2MCIgaGVpZ2h0PSIyMCIgcng9IjQiIGZpbGw9IiM4QjY5MTQiLz4KICA8cmVjdCB4PSIyOCIgeT0iMTgiIHdpZHRoPSI2NCIgaGVpZ2h0PSIxMiIgcng9IjMiIGZpbGw9IiM4QjY5MTQiLz4KICA8IS0tIEhlYWQgLS0+CiAgPHJlY3QgeD0iMzIiIHk9IjI0IiB3aWR0aD0iNTYiIGhlaWdodD0iNTAiIHJ4PSI2IiBmaWxsPSIjRjVDQkE3Ii8+CiAgPCEtLSBGcmluZ2UgLS0+CiAgPHJlY3QgeD0iMzQiIHk9IjE0IiB3aWR0aD0iMzAiIGhlaWdodD0iMTYiIHJ4PSIzIiBmaWxsPSIjOEI2OTE0Ii8+CiAgPCEtLSBFeWVzIC0tPgogIDxjaXJjbGUgY3g9IjQ4IiBjeT0iNDYiIHI9IjQiIGZpbGw9IiMyQzNFNTAiLz4KICA8Y2lyY2xlIGN4PSI3MiIgY3k9IjQ2IiByPSI0IiBmaWxsPSIjMkMzRTUwIi8+CiAgPGNpcmNsZSBjeD0iNDkiIGN5PSI0NSIgcj0iMS41IiBmaWxsPSJ3aGl0ZSIvPgogIDxjaXJjbGUgY3g9IjczIiBjeT0iNDUiIHI9IjEuNSIgZmlsbD0id2hpdGUiLz4KICA8IS0tIE1vdXRoIC0tPgogIDxwYXRoIGQ9Ik01MiA1OCBRNjAgNjIgNjggNTgiIHN0cm9rZT0iIzJDM0U1MCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8IS0tIE5lY2sgLS0+CiAgPHJlY3QgeD0iNTAiIHk9Ijc0IiB3aWR0aD0iMjAiIGhlaWdodD0iNiIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gSG9vZGllIC0tPgogIDxyZWN0IHg9IjIyIiB5PSI3NiIgd2lkdGg9Ijc2IiBoZWlnaHQ9IjQ2IiByeD0iNiIgZmlsbD0iIzkyMkIyMSIvPgogIDwhLS0gSG9vZCAtLT4KICA8cmVjdCB4PSIyNCIgeT0iNzYiIHdpZHRoPSI3MiIgaGVpZ2h0PSIxMCIgcng9IjQiIGZpbGw9IiM3QjI0MUMiLz4KICA8IS0tIEhvb2RpZSBwb2NrZXQgLS0+CiAgPHJlY3QgeD0iMzgiIHk9IjEwMCIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjE2IiByeD0iNCIgZmlsbD0iIzdCMjQxQyIvPgogIDwhLS0gU3RyaW5ncyAtLT4KICA8bGluZSB4MT0iNTAiIHkxPSI3OCIgeDI9IjQ2IiB5Mj0iOTYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgPGxpbmUgeDE9IjcwIiB5MT0iNzgiIHgyPSI3NCIgeTI9Ijk2IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDwhLS0gQXJtcyAtLT4KICA8cmVjdCB4PSIxMCIgeT0iODAiIHdpZHRoPSIxNiIgaGVpZ2h0PSIzNiIgcng9IjQiIGZpbGw9IiM5MjJCMjEiLz4KICA8cmVjdCB4PSI5NCIgeT0iODAiIHdpZHRoPSIxNiIgaGVpZ2h0PSIzNiIgcng9IjQiIGZpbGw9IiM5MjJCMjEiLz4KICA8IS0tIEhhbmRzIC0tPgogIDxyZWN0IHg9IjEyIiB5PSIxMTIiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMCIgcng9IjMiIGZpbGw9IiNGNUNCQTciLz4KICA8cmVjdCB4PSI5NiIgeT0iMTEyIiB3aWR0aD0iMTIiIGhlaWdodD0iMTAiIHJ4PSIzIiBmaWxsPSIjRjVDQkE3Ii8+CiAgPCEtLSBKZWFucyAtLT4KICA8cmVjdCB4PSIzMCIgeT0iMTIyIiB3aWR0aD0iMjYiIGhlaWdodD0iMzAiIHJ4PSIzIiBmaWxsPSIjMzQ5OERCIi8+CiAgPHJlY3QgeD0iNjQiIHk9IjEyMiIgd2lkdGg9IjI2IiBoZWlnaHQ9IjMwIiByeD0iMyIgZmlsbD0iIzM0OThEQiIvPgogIDwhLS0gU2hvZXMgLS0+CiAgPHJlY3QgeD0iMjgiIHk9IjE0OCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjEwIiByeD0iNCIgZmlsbD0iI0U3NEMzQyIvPgogIDxyZWN0IHg9IjYyIiB5PSIxNDgiIHdpZHRoPSIzMCIgaGVpZ2h0PSIxMCIgcng9IjQiIGZpbGw9IiNFNzRDM0MiLz4KPC9zdmc+Cg=="},
  {id:"wild_hair",label:"Wild Hair",src:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTYwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCI+CiAgPCEtLSBXaWxkIEhhaXIgQm95IC0tPgogIDwhLS0gV2lsZCBoYWlyIHNwaWtlcyAtLT4KICA8cmVjdCB4PSIyNCIgeT0iNiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjI0IiByeD0iMyIgZmlsbD0iI0EwNzg0QSIgdHJhbnNmb3JtPSJyb3RhdGUoLTE1LDMwLDE4KSIvPgogIDxyZWN0IHg9IjM4IiB5PSIyIiB3aWR0aD0iMTIiIGhlaWdodD0iMjYiIHJ4PSIzIiBmaWxsPSIjQTA3ODRBIiB0cmFuc2Zvcm09InJvdGF0ZSgtNSw0NCwxNSkiLz4KICA8cmVjdCB4PSI1NCIgeT0iMCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjI4IiByeD0iMyIgZmlsbD0iI0EwNzg0QSIvPgogIDxyZWN0IHg9IjY4IiB5PSIyIiB3aWR0aD0iMTIiIGhlaWdodD0iMjYiIHJ4PSIzIiBmaWxsPSIjQTA3ODRBIiB0cmFuc2Zvcm09InJvdGF0ZSg1LDc0LDE1KSIvPgogIDxyZWN0IHg9IjgyIiB5PSI2IiB3aWR0aD0iMTIiIGhlaWdodD0iMjQiIHJ4PSIzIiBmaWxsPSIjQTA3ODRBIiB0cmFuc2Zvcm09InJvdGF0ZSgxNSw4OCwxOCkiLz4KICA8IS0tIEhhaXIgYmFzZSAtLT4KICA8cmVjdCB4PSIyOCIgeT0iMTQiIHdpZHRoPSI2NCIgaGVpZ2h0PSIxNiIgcng9IjQiIGZpbGw9IiNBMDc4NEEiLz4KICA8IS0tIEhlYWQgLS0+CiAgPHJlY3QgeD0iMzIiIHk9IjI0IiB3aWR0aD0iNTYiIGhlaWdodD0iNTAiIHJ4PSI2IiBmaWxsPSIjRjVDQkE3Ii8+CiAgPCEtLSBHbGFzc2VzIC0tPgogIDxjaXJjbGUgY3g9IjQ4IiBjeT0iNDQiIHI9IjEwIiBzdHJva2U9IiMyQzNFNTAiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPgogIDxjaXJjbGUgY3g9IjcyIiBjeT0iNDQiIHI9IjEwIiBzdHJva2U9IiMyQzNFNTAiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPgogIDxsaW5lIHgxPSI1OCIgeTE9IjQ0IiB4Mj0iNjIiIHkyPSI0NCIgc3Ryb2tlPSIjMkMzRTUwIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8IS0tIEV5ZXMgLS0+CiAgPGNpcmNsZSBjeD0iNDgiIGN5PSI0NCIgcj0iMyIgZmlsbD0iIzJDM0U1MCIvPgogIDxjaXJjbGUgY3g9IjcyIiBjeT0iNDQiIHI9IjMiIGZpbGw9IiMyQzNFNTAiLz4KICA8Y2lyY2xlIGN4PSI0OSIgY3k9IjQzIiByPSIxLjIiIGZpbGw9IndoaXRlIi8+CiAgPGNpcmNsZSBjeD0iNzMiIGN5PSI0MyIgcj0iMS4yIiBmaWxsPSJ3aGl0ZSIvPgogIDwhLS0gTW91dGggKG9wZW4gc3VycHJpc2UpIC0tPgogIDxlbGxpcHNlIGN4PSI2MCIgY3k9IjYwIiByeD0iNiIgcnk9IjQiIGZpbGw9IiMyQzNFNTAiLz4KICA8IS0tIE5lY2sgLS0+CiAgPHJlY3QgeD0iNTAiIHk9Ijc0IiB3aWR0aD0iMjAiIGhlaWdodD0iNiIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gVGFuayB0b3AgLS0+CiAgPHJlY3QgeD0iMjgiIHk9Ijc4IiB3aWR0aD0iNjQiIGhlaWdodD0iNDIiIHJ4PSI0IiBmaWxsPSIjRjlFNzlGIi8+CiAgPCEtLSBBcm1zIC0tPgogIDxyZWN0IHg9IjE0IiB5PSI4MCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjM0IiByeD0iNCIgZmlsbD0iI0Y1Q0JBNyIvPgogIDxyZWN0IHg9IjkwIiB5PSI4MCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjM0IiByeD0iNCIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gSGFuZHMgLS0+CiAgPHJlY3QgeD0iMTYiIHk9IjExMCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEwIiByeD0iMyIgZmlsbD0iI0Y1Q0JBNyIvPgogIDxyZWN0IHg9IjkyIiB5PSIxMTAiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMCIgcng9IjMiIGZpbGw9IiNGNUNCQTciLz4KICA8IS0tIFNob3J0cyAtLT4KICA8cmVjdCB4PSIzMCIgeT0iMTIwIiB3aWR0aD0iMjYiIGhlaWdodD0iMjAiIHJ4PSIzIiBmaWxsPSIjMjdBRTYwIi8+CiAgPHJlY3QgeD0iNjQiIHk9IjEyMCIgd2lkdGg9IjI2IiBoZWlnaHQ9IjIwIiByeD0iMyIgZmlsbD0iIzI3QUU2MCIvPgogIDwhLS0gTGVncyAtLT4KICA8cmVjdCB4PSIzNiIgeT0iMTM4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTQiIHJ4PSIyIiBmaWxsPSIjRjVDQkE3Ii8+CiAgPHJlY3QgeD0iNjgiIHk9IjEzOCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE0IiByeD0iMiIgZmlsbD0iI0Y1Q0JBNyIvPgogIDwhLS0gU2hvZXMgLS0+CiAgPHJlY3QgeD0iMzIiIHk9IjE0OCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjEwIiByeD0iNCIgZmlsbD0iIzM0OThEQiIvPgogIDxyZWN0IHg9IjY0IiB5PSIxNDgiIHdpZHRoPSIyNCIgaGVpZ2h0PSIxMCIgcng9IjQiIGZpbGw9IiMzNDk4REIiLz4KPC9zdmc+Cg=="},
  {id:"pigtail_girl",label:"Pigtail Girl",src:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTYwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCI+CiAgPCEtLSBQaWd0YWlsIEdpcmwgLS0+CiAgPCEtLSBQaWd0YWlscyAtLT4KICA8cmVjdCB4PSIxMCIgeT0iMjIiIHdpZHRoPSIxNiIgaGVpZ2h0PSIzMCIgcng9IjYiIGZpbGw9IiM2QjQyMjYiLz4KICA8cmVjdCB4PSI5NCIgeT0iMjIiIHdpZHRoPSIxNiIgaGVpZ2h0PSIzMCIgcng9IjYiIGZpbGw9IiM2QjQyMjYiLz4KICA8IS0tIEhhaXIgdGllcyAtLT4KICA8Y2lyY2xlIGN4PSIxOCIgY3k9IjIyIiByPSI1IiBmaWxsPSIjRTc0QzNDIi8+CiAgPGNpcmNsZSBjeD0iMTAyIiBjeT0iMjIiIHI9IjUiIGZpbGw9IiNFNzRDM0MiLz4KICA8IS0tIEhhaXIgLS0+CiAgPHJlY3QgeD0iMzAiIHk9IjgiIHdpZHRoPSI2MCIgaGVpZ2h0PSIyNCIgcng9IjQiIGZpbGw9IiM2QjQyMjYiLz4KICA8cmVjdCB4PSIyNiIgeT0iMTgiIHdpZHRoPSI2OCIgaGVpZ2h0PSIxMiIgcng9IjMiIGZpbGw9IiM2QjQyMjYiLz4KICA8IS0tIEhlYWQgLS0+CiAgPHJlY3QgeD0iMzIiIHk9IjI0IiB3aWR0aD0iNTYiIGhlaWdodD0iNTAiIHJ4PSI2IiBmaWxsPSIjRDRBNTc0Ii8+CiAgPCEtLSBCYW5ncyAtLT4KICA8cmVjdCB4PSIzNCIgeT0iMTIiIHdpZHRoPSI1MiIgaGVpZ2h0PSIxNiIgcng9IjMiIGZpbGw9IiM2QjQyMjYiLz4KICA8IS0tIEV5ZXMgLS0+CiAgPGNpcmNsZSBjeD0iNDgiIGN5PSI0NiIgcj0iNCIgZmlsbD0iIzJDM0U1MCIvPgogIDxjaXJjbGUgY3g9IjcyIiBjeT0iNDYiIHI9IjQiIGZpbGw9IiMyQzNFNTAiLz4KICA8Y2lyY2xlIGN4PSI0OSIgY3k9IjQ1IiByPSIxLjUiIGZpbGw9IndoaXRlIi8+CiAgPGNpcmNsZSBjeD0iNzMiIGN5PSI0NSIgcj0iMS41IiBmaWxsPSJ3aGl0ZSIvPgogIDwhLS0gQmx1c2ggLS0+CiAgPGNpcmNsZSBjeD0iNDIiIGN5PSI1MiIgcj0iNCIgZmlsbD0iI0U4QTBBMCIgb3BhY2l0eT0iMC41Ii8+CiAgPGNpcmNsZSBjeD0iNzgiIGN5PSI1MiIgcj0iNCIgZmlsbD0iI0U4QTBBMCIgb3BhY2l0eT0iMC41Ii8+CiAgPCEtLSBNb3V0aCAtLT4KICA8cGF0aCBkPSJNNTQgNTggUTYwIDY0IDY2IDU4IiBzdHJva2U9IiMyQzNFNTAiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPCEtLSBOZWNrIC0tPgogIDxyZWN0IHg9IjUwIiB5PSI3NCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjYiIGZpbGw9IiNENEE1NzQiLz4KICA8IS0tIFQtc2hpcnQgLS0+CiAgPHJlY3QgeD0iMjQiIHk9Ijc4IiB3aWR0aD0iNzIiIGhlaWdodD0iNDAiIHJ4PSI0IiBmaWxsPSIjOEU0NEFEIi8+CiAgPCEtLSBTdGFyIC0tPgogIDxjaXJjbGUgY3g9IjYwIiBjeT0iOTgiIHI9IjgiIGZpbGw9IiNEMkI0REUiLz4KICA8IS0tIEFybXMgLS0+CiAgPHJlY3QgeD0iMTIiIHk9IjgwIiB3aWR0aD0iMTYiIGhlaWdodD0iMzIiIHJ4PSI0IiBmaWxsPSIjOEU0NEFEIi8+CiAgPHJlY3QgeD0iOTIiIHk9IjgwIiB3aWR0aD0iMTYiIGhlaWdodD0iMzIiIHJ4PSI0IiBmaWxsPSIjOEU0NEFEIi8+CiAgPCEtLSBIYW5kcyAtLT4KICA8cmVjdCB4PSIxNCIgeT0iMTA4IiB3aWR0aD0iMTIiIGhlaWdodD0iMTAiIHJ4PSIzIiBmaWxsPSIjRDRBNTc0Ii8+CiAgPHJlY3QgeD0iOTQiIHk9IjEwOCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEwIiByeD0iMyIgZmlsbD0iI0Q0QTU3NCIvPgogIDwhLS0gU2tpcnQgLS0+CiAgPHBhdGggZD0iTTI4IDExOCBMMjIgMTQ4IEw5OCAxNDggTDkyIDExOCBaIiBmaWxsPSIjMkMzRTUwIi8+CiAgPCEtLSBMZWdzIC0tPgogIDxyZWN0IHg9IjQyIiB5PSIxNDAiIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgcng9IjIiIGZpbGw9IiNENEE1NzQiLz4KICA8cmVjdCB4PSI2NiIgeT0iMTQwIiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiBmaWxsPSIjRDRBNTc0Ii8+CiAgPCEtLSBTaG9lcyAtLT4KICA8cmVjdCB4PSIzOCIgeT0iMTQ4IiB3aWR0aD0iMjAiIGhlaWdodD0iMTAiIHJ4PSI0IiBmaWxsPSIjMkMzRTUwIi8+CiAgPHJlY3QgeD0iNjIiIHk9IjE0OCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjEwIiByeD0iNCIgZmlsbD0iIzJDM0U1MCIvPgo8L3N2Zz4K"},
];

/* ─────────────────────────────────────────────
   SVG HELPERS
───────────────────────────────────────────── */
function makeSvgCover(title="",authors="") {
  const palette=[["#E8426A","#F7C59F"],["#3B82F6","#BFDBFE"],["#8B5CF6","#DDD6FE"],
    ["#10B981","#A7F3D0"],["#F59E0B","#FDE68A"],["#EF4444","#FECACA"],["#06B6D4","#CFFAFE"],["#EC4899","#FBCFE8"]];
  const hash=[...(title+authors)].reduce((a,c)=>a+c.charCodeAt(0),0);
  const [bg,accent]=palette[hash%palette.length];
  const words=title.trim().split(" "); const lines=[]; let line="";
  for(const w of words){if((line+" "+w).trim().length>10&&line){lines.push(line);line=w;}else line=(line+" "+w).trim();}
  if(line)lines.push(line);
  const ls=lines.slice(0,3).map(l=>l.replace(/&/g,"&amp;").replace(/</g,"&lt;"));
  const auth=(authors||"").split(" ").slice(-1)[0]||"";
  const midY=56,lh=13,sy=midY-((ls.length-1)*lh)/2;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="90" height="130" viewBox="0 0 90 130">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${bg}cc"/></linearGradient></defs>
    <rect width="90" height="130" fill="url(#g)" rx="4"/>
    <rect x="0" y="0" width="7" height="130" fill="${accent}" opacity="0.95"/>
    ${ls.map((l,i)=>`<text x="48" y="${sy+i*lh}" text-anchor="middle" font-family="Georgia,serif" font-size="10" font-weight="bold" fill="white" opacity="0.95">${l}</text>`).join("")}
    <text x="48" y="122" text-anchor="middle" font-family="Georgia,serif" font-size="8" fill="white" opacity="0.65">${auth.replace(/&/g,"&amp;")}</text>
  </svg>`;
  return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg)));
}

function makeAvatarSvg(name="",colorIdx=0) {
  const [bg,ac]=AVATAR_COLORS[colorIdx%AVATAR_COLORS.length];
  const initials=name.trim().split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase()||"?";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="24" fill="${bg}"/>
    <circle cx="24" cy="24" r="22" fill="none" stroke="${ac}" stroke-width="2" opacity="0.6"/>
    <text x="24" y="30" text-anchor="middle" font-family="Calibri,sans-serif" font-size="18" font-weight="900" fill="white">${initials}</text>
  </svg>`;
  return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg)));
}

/* ─────────────────────────────────────────────
   SMALL UI COMPONENTS
───────────────────────────────────────────── */
function Badge({color,children}) {
  return <span className="badge" style={{background:color+"22",color,border:`1px solid ${color}44`}}>{children}</span>;
}
function Avatar({child,size=40,ring=false}) {
  // avatar can be: a character key (e.g. "hoodie_boy"), a URL, or null
  const charAvatar = AVATAR_CHARACTERS.find(a=>a.id===child.avatar);
  const src = charAvatar ? charAvatar.src : (child.avatar || makeAvatarSvg(child.name, child.colorIdx||0));
  return <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:ring?`2px solid ${AVATAR_COLORS[child.colorIdx||0][0]}`:"2px solid rgba(255,255,255,0.15)"}}><img src={src} alt={child.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>;
}
function RewardPill({reward,earned}) {
  return <div className="reward-pill" style={{background:reward.color+"15",border:`1.5px solid ${reward.color}33`}}><span className="reward-pill-icon">{reward.icon}</span><div style={{minWidth:0}}><div className="reward-pill-label">{reward.label.toUpperCase()}</div><div className="reward-pill-value" style={{color:reward.color}}>{earned}{reward.unit==="p"?"p":` ${reward.unit}`}</div></div></div>;
}
function BookSlot({book,onMarkDone,onLogReading}) {
  if(!book) return <div className="book-slot-empty"><div style={{fontSize:28}}>＋</div><div>Empty slot</div></div>;
  const prog=Math.min(100,Math.round((book.pagesRead/book.totalPages)*100));
  return <div className="book-slot">
    <div className="book-slot-cover"><div className="book-slot-cover-inner">
      <img src={book.cover} alt={book.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
      {book.done&&<div className="book-slot-done-overlay">✅</div>}
      {!book.done&&<div className="book-slot-progress"><div className="book-slot-progress-fill" style={{width:`${prog}%`}}/></div>}
    </div></div>
    <div className="book-slot-info">
      <div className="book-slot-title">{book.title.length>18?book.title.slice(0,16)+"…":book.title}</div>
      {book.authors&&<div className="book-slot-author">{book.authors.split(" ").slice(-1)[0]}</div>}
      <div className="book-slot-pages">{book.pagesRead}/{book.totalPages} pp</div>
      {!book.done&&<div className="book-slot-actions">
        <button className="book-slot-log-btn" onClick={()=>onLogReading(book)}>+ Log pages</button>
        <button className="book-slot-done-btn" onClick={()=>onMarkDone(book.id)}>✓ Done!</button>
      </div>}
      {book.done&&<div className="book-slot-completed">🎉 Completed!</div>}
    </div>
  </div>;
}

/* ─────────────────────────────────────────────
   PIN PAD COMPONENT
───────────────────────────────────────────── */
function PinPad({length=4, value, onChange, error}) {
  const inputs = useRef([]);

  function handleKey(i, e) {
    const raw = e.target.value.replace(/\D/g,"");
    // If user typed multiple digits (e.g. replacing), only take the last one
    const digit = raw.slice(-1);
    const arr = value.padEnd(length," ").split("").slice(0, length);
    arr[i] = digit;
    const next = arr.join("").trimEnd();
    onChange(next);
    // Auto-advance: move forward when a digit was entered
    if(digit && i < length - 1) {
      setTimeout(() => inputs.current[i+1]?.focus(), 0);
    }
    // Auto-retreat: move back on backspace/delete of empty field
    if(!digit && e.nativeEvent.inputType === "deleteContentBackward" && i > 0) {
      setTimeout(() => inputs.current[i-1]?.focus(), 0);
    }
  }

  function handleKeyDown(i, e) {
    // Allow retreat with backspace even when field already empty
    if(e.key === "Backspace" && !value[i] && i > 0) {
      const arr = value.padEnd(length," ").split("").slice(0, length);
      arr[i-1] = "";
      onChange(arr.join("").trimEnd());
      setTimeout(() => inputs.current[i-1]?.focus(), 0);
    }
    // Jump forward on ArrowRight, back on ArrowLeft
    if(e.key === "ArrowRight" && i < length-1) { e.preventDefault(); inputs.current[i+1]?.focus(); }
    if(e.key === "ArrowLeft"  && i > 0)         { e.preventDefault(); inputs.current[i-1]?.focus(); }
  }

  function handleFocus(i) {
    // Select the content so typing replaces it cleanly
    inputs.current[i]?.select();
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,length);
    onChange(text);
    const focusIdx = Math.min(text.length, length-1);
    setTimeout(() => inputs.current[focusIdx]?.focus(), 0);
    e.preventDefault();
  }

  return (
    <div>
      <div className="pin-row">
        {Array.from({length}).map((_,i)=>(
          <input key={i} ref={el=>inputs.current[i]=el}
            type="password" inputMode="numeric" maxLength={1}
            value={value[i]||""}
            onChange={e=>handleKey(i,e)}
            onKeyDown={e=>handleKeyDown(i,e)}
            onFocus={()=>handleFocus(i)}
            onPaste={handlePaste}
            className="pin-input"
            style={{border:`2px solid ${error?"#E74C3C":value[i]?"#4776E6":"rgba(255,255,255,0.2)"}`}}
          />
        ))}
      </div>
      {error&&<div className="pin-error">{error}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODULE-LEVEL STYLES & WRAPPER
   Must live outside App so React never remounts
   inputs on re-render (fixes focus/cursor loss)
───────────────────────────────────────────── */
function Wrap({children}) {
  return <div className="app-wrap">{children}</div>;
}

/* ─────────────────────────────────────────────
   INITIAL STATE (empty — data comes from Supabase)
───────────────────────────────────────────── */


/* ─────────────────────────────────────────────
   SETUP TAB COMPONENT
───────────────────────────────────────────── */
function SetupTab({parentAccount,myChildren,rewards,setRewards,diffBonuses,setDiffBonuses,calcPts,onLogout,onSaveReward,onDeleteReward,onSaveBonus,onChangePin}) {
  const [section, setSection] = useState("exchange"); // exchange | pins | account
  const [editingRewardId, setEditingRewardId] = useState(null);
  const [newRewardForm, setNewRewardForm] = useState({label:"",icon:"🎯",unit:"mins",rate:2,color:"#3B82F6",showIconPicker:false,showColorPicker:false});
  const [showNewRewardForm, setShowNewRewardForm] = useState(false);
  const [editPin, setEditPin] = useState({id:null,pin:"",confirm:"",error:"",saving:false});

  // Save a reward to DB after local state update
  function updateRewardAndSave(id, field, val) {
    setRewards(prev => {
      const updated = prev.map(r => r.id===id ? {...r, [field]:val} : r);
      const reward = updated.find(r => r.id===id);
      if (reward && !field.startsWith("_")) onSaveReward?.(reward); // skip internal fields like _showIcons
      return updated;
    });
  }
  function updateReward(id, field, val) {
    // For internal UI state (like _showIcons), don't save to DB
    if (field.startsWith("_")) {
      setRewards(prev => prev.map(r => r.id===id ? {...r, [field]:val} : r));
    } else {
      updateRewardAndSave(id, field, val);
    }
  }
  function deleteReward(id) {
    setRewards(prev => prev.filter(r => r.id!==id));
    onDeleteReward?.(id);
    if(editingRewardId===id) setEditingRewardId(null);
  }
  function addReward() {
    if(!newRewardForm.label.trim()) return;
    const newR = {
      id: "r"+Date.now(),
      label: newRewardForm.label.trim(),
      icon:  newRewardForm.icon,
      unit:  newRewardForm.unit.trim()||"mins",
      rate:  parseFloat(newRewardForm.rate)||1,
      color: newRewardForm.color,
    };
    setRewards(prev => [...prev, newR]);
    onSaveReward?.(newR);
    setNewRewardForm({label:"",icon:"🎯",unit:"mins",rate:2,color:"#3B82F6",showIconPicker:false,showColorPicker:false});
    setShowNewRewardForm(false);
  }
  function updateBonus(diff, field, val) {
    setDiffBonuses(prev => {
      const updated = {...prev, [diff]:{...prev[diff],[field]:val}};
      onSaveBonus?.(diff, updated[diff]);
      return updated;
    });
  }

  const SAMPLE_PAGES = 20;
  const sampleDiff = "medium";

  const NAV_TABS = [
    {id:"exchange", label:"💱 Exchange Rate"},
    {id:"pins",     label:"🔒 Child PINs"},
    {id:"account",  label:"👤 Account"},
  ];

  return (
    <div className="pop" style={{paddingBottom:20}}>
      <div style={{fontSize:20,fontWeight:900,marginBottom:16}}>⚙️ Setup</div>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:6,marginBottom:20,background:"rgba(255,255,255,0.05)",borderRadius:14,padding:4}}>
        {NAV_TABS.map(t=>(
          <button key={t.id} className="btn" onClick={()=>setSection(t.id)} style={{flex:1,padding:"9px 4px",fontSize:11,background:section===t.id?"rgba(255,255,255,0.15)":"transparent",color:section===t.id?"#fff":"rgba(255,255,255,0.4)",borderRadius:10}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── EXCHANGE RATE ── */}
      {section==="exchange" && (
        <>
          {/* Reward types */}
          <div style={{marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div className="slabel" style={{margin:0}}>REWARD TYPES</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>Base rate: per 10 pages</div>
          </div>

          {rewards.map(r=>{
            const isEditing = editingRewardId===r.id;
            const previewPts = calcPts(SAMPLE_PAGES,"medium",r.id,[r],diffBonuses);
            return (
              <div key={r.id} className="card" style={{marginBottom:10,overflow:"hidden",border:`1px solid ${r.color}33`}}>
                {/* Header row */}
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}} onClick={()=>setEditingRewardId(isEditing?null:r.id)}>
                  <div style={{width:36,height:36,borderRadius:10,background:r.color+"22",border:`1.5px solid ${r.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{r.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:14,color:"#fff"}}>{r.label}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>{r.rate} {r.unit} per 10 pages · preview: <span style={{color:r.color,fontWeight:700}}>{previewPts} {r.unit}</span> for {SAMPLE_PAGES}p medium</div>
                  </div>
                  <div style={{fontSize:16,color:"rgba(255,255,255,0.3)",transform:isEditing?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▾</div>
                </div>

                {/* Edit panel */}
                {isEditing && (
                  <div style={{padding:"0 14px 14px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                    <div style={{display:"flex",gap:10,marginTop:12,marginBottom:10}}>
                      {/* Icon picker */}
                      <div style={{flex:"0 0 auto"}}>
                        <div className="slabel">ICON</div>
                        <div style={{position:"relative"}}>
                          <button onClick={()=>updateReward(r.id,"_showIcons",!r._showIcons)} style={{width:48,height:48,borderRadius:10,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",fontSize:22,cursor:"pointer"}}>{r.icon}</button>
                          {r._showIcons && (
                            <div style={{position:"absolute",top:52,left:0,background:"#1a1a2e",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,padding:8,display:"flex",flexWrap:"wrap",gap:4,width:180,zIndex:10}}>
                              {REWARD_ICONS.map(ic=><button key={ic} onClick={()=>{updateReward(r.id,"icon",ic);updateReward(r.id,"_showIcons",false);}} style={{width:32,height:32,background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,fontSize:16,cursor:"pointer"}}>{ic}</button>)}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Label */}
                      <div style={{flex:2}}>
                        <div className="slabel">LABEL</div>
                        <input className="ifield" value={r.label} onChange={e=>updateReward(r.id,"label",e.target.value)} style={{padding:"10px 12px",fontSize:13}}/>
                      </div>
                      {/* Unit */}
                      <div style={{flex:1}}>
                        <div className="slabel">UNIT</div>
                        <input className="ifield" value={r.unit} onChange={e=>updateReward(r.id,"unit",e.target.value)} style={{padding:"10px 12px",fontSize:13}}/>
                      </div>
                    </div>
                    {/* Base rate */}
                    <div style={{marginBottom:10}}>
                      <div className="slabel">BASE RATE ({r.unit} per 10 pages)</div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <button onClick={()=>updateReward(r.id,"rate",Math.max(0.5,parseFloat((r.rate-0.5).toFixed(1))))} style={{width:38,height:38,borderRadius:10,border:"none",background:"rgba(255,255,255,0.1)",color:"#fff",fontSize:18,fontWeight:900,cursor:"pointer"}}>−</button>
                        <input type="number" value={r.rate} step="0.5" min="0.5"
                          onChange={e=>updateReward(r.id,"rate",parseFloat(e.target.value)||0.5)}
                          style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"8px 0",color:"#fff",fontSize:20,fontWeight:900,textAlign:"center",outline:"none"}}/>
                        <button onClick={()=>updateReward(r.id,"rate",parseFloat((r.rate+0.5).toFixed(1)))} style={{width:38,height:38,borderRadius:10,border:"none",background:"rgba(255,255,255,0.1)",color:"#fff",fontSize:18,fontWeight:900,cursor:"pointer"}}>＋</button>
                      </div>
                    </div>
                    {/* Color */}
                    <div style={{marginBottom:12}}>
                      <div className="slabel">COLOUR</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {REWARD_COLORS.map(c=><button key={c} onClick={()=>updateReward(r.id,"color",c)} style={{width:28,height:28,borderRadius:"50%",background:c,border:r.color===c?"3px solid white":"3px solid transparent",cursor:"pointer"}}/>)}
                      </div>
                    </div>
                    {/* Redemption tiers */}
                    <div style={{marginBottom:12}}>
                      <div className="slabel">REDEMPTION TIERS</div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {(r.tiers||[]).map((tier,ti)=>(
                          <div key={ti} style={{display:"flex",gap:8,alignItems:"center"}}>
                            <input className="ifield" value={tier.label} placeholder="Label" onChange={e=>{
                              const newTiers=[...(r.tiers||[])]; newTiers[ti]={...newTiers[ti],label:e.target.value};
                              updateReward(r.id,"tiers",newTiers);
                            }} style={{flex:1,padding:"8px 10px",fontSize:12}}/>
                            <input className="ifield" type="number" value={tier.amount} placeholder="Amount" onChange={e=>{
                              const newTiers=[...(r.tiers||[])]; newTiers[ti]={...newTiers[ti],amount:parseInt(e.target.value)||0};
                              updateReward(r.id,"tiers",newTiers);
                            }} style={{width:70,padding:"8px 10px",fontSize:12,textAlign:"center"}}/>
                            <button onClick={()=>{
                              const newTiers=(r.tiers||[]).filter((_,i)=>i!==ti);
                              updateReward(r.id,"tiers",newTiers);
                            }} style={{border:"none",background:"rgba(231,76,60,0.2)",color:"#E74C3C",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:14}}>✕</button>
                          </div>
                        ))}
                        <button onClick={()=>{
                          const newTiers=[...(r.tiers||[]),{label:"New",amount:10}];
                          updateReward(r.id,"tiers",newTiers);
                        }} style={{border:"1px dashed rgba(255,255,255,0.2)",background:"none",color:"rgba(255,255,255,0.4)",padding:"8px 0",borderRadius:8,fontSize:12,cursor:"pointer"}}>＋ Add tier</button>
                      </div>
                    </div>
                    {/* Auto-approve toggle */}
                    <div style={{marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>Auto-approve redemptions</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>Skip parent approval when kids redeem</div>
                      </div>
                      <button onClick={()=>updateReward(r.id,"autoApprove",!r.autoApprove)} style={{width:48,height:26,borderRadius:13,border:"none",background:r.autoApprove?"#27AE60":"rgba(255,255,255,0.15)",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
                        <div style={{width:22,height:22,borderRadius:"50%",background:"white",position:"absolute",top:2,left:r.autoApprove?24:2,transition:"left 0.2s"}}/>
                      </button>
                    </div>
                    <button onClick={()=>deleteReward(r.id)} style={{border:"none",background:"rgba(231,76,60,0.15)",color:"#E74C3C",padding:"8px 16px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer"}}>🗑 Remove this reward</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new reward */}
          {!showNewRewardForm ? (
            <button className="btn" onClick={()=>setShowNewRewardForm(true)} style={{width:"100%",padding:"12px 0",fontSize:14,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"2px dashed rgba(255,255,255,0.15)",marginBottom:20}}>
              ＋ Add Custom Reward
            </button>
          ) : (
            <div className="card" style={{padding:14,marginBottom:20,border:"1px solid rgba(71,118,230,0.4)"}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:12}}>New Reward</div>
              <div style={{display:"flex",gap:10,marginBottom:10}}>
                <div>
                  <div className="slabel">ICON</div>
                  <div style={{position:"relative"}}>
                    <button onClick={()=>setNewRewardForm(f=>({...f,showIconPicker:!f.showIconPicker}))} style={{width:48,height:48,borderRadius:10,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",fontSize:22,cursor:"pointer"}}>{newRewardForm.icon}</button>
                    {newRewardForm.showIconPicker && (
                      <div style={{position:"absolute",top:52,left:0,background:"#1a1a2e",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,padding:8,display:"flex",flexWrap:"wrap",gap:4,width:180,zIndex:10}}>
                        {REWARD_ICONS.map(ic=><button key={ic} onClick={()=>setNewRewardForm(f=>({...f,icon:ic,showIconPicker:false}))} style={{width:32,height:32,background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,fontSize:16,cursor:"pointer"}}>{ic}</button>)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{flex:2}}>
                  <div className="slabel">LABEL *</div>
                  <input className="ifield" placeholder="e.g. Dessert Time" value={newRewardForm.label} onChange={e=>setNewRewardForm(f=>({...f,label:e.target.value}))} style={{padding:"10px 12px",fontSize:13}}/>
                </div>
                <div style={{flex:1}}>
                  <div className="slabel">UNIT</div>
                  <input className="ifield" placeholder="mins" value={newRewardForm.unit} onChange={e=>setNewRewardForm(f=>({...f,unit:e.target.value}))} style={{padding:"10px 12px",fontSize:13}}/>
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div className="slabel">BASE RATE (per 10 pages)</div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button onClick={()=>setNewRewardForm(f=>({...f,rate:Math.max(0.5,parseFloat((f.rate-0.5).toFixed(1)))}))} style={{width:38,height:38,borderRadius:10,border:"none",background:"rgba(255,255,255,0.1)",color:"#fff",fontSize:18,fontWeight:900,cursor:"pointer"}}>−</button>
                  <input type="number" value={newRewardForm.rate} step="0.5" min="0.5"
                    onChange={e=>setNewRewardForm(f=>({...f,rate:parseFloat(e.target.value)||0.5}))}
                    style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"8px 0",color:"#fff",fontSize:20,fontWeight:900,textAlign:"center",outline:"none"}}/>
                  <button onClick={()=>setNewRewardForm(f=>({...f,rate:parseFloat((f.rate+0.5).toFixed(1))}))} style={{width:38,height:38,borderRadius:10,border:"none",background:"rgba(255,255,255,0.1)",color:"#fff",fontSize:18,fontWeight:900,cursor:"pointer"}}>＋</button>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div className="slabel">COLOUR</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {REWARD_COLORS.map(c=><button key={c} onClick={()=>setNewRewardForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:newRewardForm.color===c?"3px solid white":"3px solid transparent",cursor:"pointer"}}/>)}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn" onClick={addReward} style={{flex:2,padding:"11px 0",background:"linear-gradient(135deg,#27AE60,#2ECC71)",color:"#fff",fontSize:14}}>＋ Add Reward</button>
                <button className="btn" onClick={()=>setShowNewRewardForm(false)} style={{flex:1,padding:"11px 0",background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)",fontSize:13}}>Cancel</button>
              </div>
            </div>
          )}

          {/* Difficulty bonuses */}
          <div className="slabel">DIFFICULTY BONUSES</div>
          <div className="card" style={{padding:16,marginBottom:20}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:14,lineHeight:1.5}}>
              Bonus rewards on top of the base rate, applied when a child logs a session for that difficulty level.
            </div>
            {Object.entries(DIFFICULTY_LABELS).map(([diff,label])=>{
              const bonus = diffBonuses[diff] || {bonusType:"percent",bonusValue:0};
              const previewReward = rewards[0];
              const basePts  = previewReward ? Math.round(SAMPLE_PAGES * previewReward.rate / 10) : 0;
              const bonusPts = previewReward ? calcPts(SAMPLE_PAGES, diff, previewReward.id) : 0;
              return (
                <div key={diff} style={{marginBottom:16,paddingBottom:16,borderBottom:diff!=="hard"?"1px solid rgba(255,255,255,0.07)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{fontWeight:800,fontSize:14}}>{label}</div>
                    {previewReward && <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>
                      {SAMPLE_PAGES}p → <span style={{color:previewReward.color,fontWeight:700}}>{basePts}</span>
                      {bonusPts!==basePts&&<span> + <span style={{color:"#F59E0B",fontWeight:700}}>{bonusPts-basePts}</span> bonus = <span style={{color:"#2ECC71",fontWeight:700}}>{bonusPts}</span></span>}
                      {" "}{previewReward.unit}
                    </div>}
                  </div>
                  {/* Bonus type toggle */}
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    {["percent","absolute"].map(type=>(
                      <button key={type} className="btn" onClick={()=>updateBonus(diff,"bonusType",type)} style={{flex:1,padding:"8px 0",fontSize:12,background:bonus.bonusType===type?"rgba(71,118,230,0.3)":"rgba(255,255,255,0.06)",border:bonus.bonusType===type?"1.5px solid #4776E6":"1.5px solid transparent",color:"#fff"}}>
                        {type==="percent"?"% Percentage":"+ Flat bonus"}
                      </button>
                    ))}
                  </div>
                  {/* Bonus value stepper */}
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>updateBonus(diff,"bonusValue",Math.max(0,(bonus.bonusValue||0)-5))} style={{width:38,height:38,borderRadius:10,border:"none",background:"rgba(255,255,255,0.1)",color:"#fff",fontSize:18,fontWeight:900,cursor:"pointer"}}>−</button>
                    <div style={{flex:1,textAlign:"center"}}>
                      <input type="number" value={bonus.bonusValue||0} min="0" step="5"
                        onChange={e=>updateBonus(diff,"bonusValue",Math.max(0,parseInt(e.target.value)||0))}
                        style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"8px 0",color:"#fff",fontSize:20,fontWeight:900,textAlign:"center",outline:"none"}}/>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:3}}>
                        {bonus.bonusType==="percent"?"% bonus on top of base rate":"extra per 10 pages"}
                      </div>
                    </div>
                    <button onClick={()=>updateBonus(diff,"bonusValue",(bonus.bonusValue||0)+5)} style={{width:38,height:38,borderRadius:10,border:"none",background:"rgba(255,255,255,0.1)",color:"#fff",fontSize:18,fontWeight:900,cursor:"pointer"}}>＋</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live preview table */}
          <div className="slabel">LIVE PREVIEW — 20 PAGES</div>
          <div className="card" style={{padding:14,marginBottom:20,overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left",color:"rgba(255,255,255,0.4)",fontWeight:700,padding:"4px 6px"}}>Reward</th>
                  {Object.entries(DIFFICULTY_LABELS).map(([d,l])=><th key={d} style={{textAlign:"center",color:"rgba(255,255,255,0.4)",fontWeight:700,padding:"4px 6px"}}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {rewards.map(r=>(
                  <tr key={r.id}>
                    <td style={{padding:"6px 6px",fontWeight:700,color:r.color}}>{r.icon} {r.label}</td>
                    {Object.keys(DIFFICULTY_LABELS).map(d=>(
                      <td key={d} style={{textAlign:"center",padding:"6px 6px",color:"#fff",fontWeight:800}}>
                        {calcPts(SAMPLE_PAGES,d,r.id)} <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{r.unit}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── CHILD PINs ── */}
      {section==="pins" && (
        <div className="card" style={{padding:16,marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:12}}>🔒 Children's PINs</div>
          {myChildren.length===0 && <div style={{color:"rgba(255,255,255,0.3)",fontSize:13}}>No children added yet.</div>}
          {myChildren.map((child,idx)=>{
            const isEditing = editPin.id===child.id;
            return (
              <div key={child.id} style={{paddingBottom:12,marginBottom:idx<myChildren.length-1?12:0,borderBottom:idx<myChildren.length-1?"1px solid rgba(255,255,255,0.07)":"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Avatar child={child} size={36}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{child.name}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:3}}>PIN is securely hashed</div>
                  </div>
                  <button className="btn" onClick={()=>setEditPin(isEditing?{id:null,pin:"",confirm:"",error:"",saving:false}:{id:child.id,pin:"",confirm:"",error:"",saving:false})} style={{background:"rgba(71,118,230,0.2)",color:"#93C5FD",padding:"7px 12px",fontSize:12}}>
                    {isEditing?"Cancel":"✏️ Change"}
                  </button>
                </div>
                {isEditing && (
                  <div style={{marginTop:14}}>
                    <div style={{marginBottom:12}}><div className="slabel">NEW PIN</div><PinPad length={4} value={editPin.pin} onChange={v=>setEditPin(f=>({...f,pin:v,error:""}))}/></div>
                    <div style={{marginBottom:14}}><div className="slabel">CONFIRM PIN</div><PinPad length={4} value={editPin.confirm} onChange={v=>setEditPin(f=>({...f,confirm:v,error:""}))} error={editPin.error}/></div>
                    <button className="btn" disabled={editPin.saving} onClick={async()=>{
                      if(editPin.pin.length<4) return setEditPin(f=>({...f,error:"Must be 4 digits"}));
                      if(editPin.pin!==editPin.confirm) return setEditPin(f=>({...f,error:"PINs don't match"}));
                      setEditPin(f=>({...f,saving:true}));
                      const err = await onChangePin(child.id, editPin.pin);
                      if(err) { setEditPin(f=>({...f,saving:false,error:err})); return; }
                      setEditPin({id:null,pin:"",confirm:"",error:"",saving:false});
                    }} style={{width:"100%",padding:"11px 0",background:"linear-gradient(135deg,#27AE60,#2ECC71)",color:"#fff",fontSize:14,opacity:editPin.saving?0.6:1}}>
                      {editPin.saving?"Saving…":"Save New PIN"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ACCOUNT ── */}
      {section==="account" && (
        <>
          <div className="card" style={{padding:16,marginBottom:14}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:10}}>Your Account</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>Username</span><span style={{fontSize:13,fontWeight:700}}>{parentAccount.username}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>Email</span><span style={{fontSize:13,fontWeight:700}}>{parentAccount.email}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>Password</span><span style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>••••••••</span></div>
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:10}}>To change your password, log out and use "Forgot password?" on the login screen.</div>
          </div>
          <button className="btn" onClick={onLogout} style={{width:"100%",padding:"13px 0",fontSize:14,background:"rgba(231,76,60,0.18)",color:"#E74C3C",border:"1px solid #E74C3C33"}}>
            🚪 Log Out
          </button>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════ */
export default function App() {
  /* ── auth state ── */
  // screen: loading | landing | parentSignup | checkEmail | parentLogin | forgotPassword | resetPassword | app
  const [screen, setScreen]           = useState("loading");
  const [parentAccount, setParentAccount] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  /* ── exchange rate config (editable by parent) ── */
  const [rewards, setRewards]           = useState(DEFAULT_REWARDS);
  const [diffBonuses, setDiffBonuses]   = useState(DEFAULT_DIFFICULTY_BONUSES);

  /* ── Auth: track the authenticated user ── */
  const [authUser, setAuthUser] = useState(undefined); // undefined=loading, null=no user, object=user
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const authUserIdRef = useRef(null); // track current user ID to avoid redundant updates

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        authUserIdRef.current = session.user.id;
        setAuthUser(session.user);
        return;
      }
      if (event === "SIGNED_OUT") {
        authUserIdRef.current = null;
        setAuthUser(null);
        return;
      }
      if (session?.user) {
        // Only update state if the user actually changed (not just a token refresh)
        if (authUserIdRef.current !== session.user.id) {
          authUserIdRef.current = session.user.id;
          setAuthUser(session.user);
        }
      } else {
        // No session — set to null (handles INITIAL_SESSION with no user)
        authUserIdRef.current = null;
        setAuthUser(prev => prev === undefined ? null : prev);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── When authUser changes, load data or show landing ── */
  useEffect(() => {
    if (authUser === undefined) return; // still loading
    if (authUser === null) { setScreen("landing"); return; }
    // If password recovery, show reset screen instead of dashboard
    if (passwordRecovery) { setScreen("resetPassword"); return; }
    // User is authenticated — load their data
    let cancelled = false;
    async function load() {
      try {
        await loadParentData(authUser);
        if (!cancelled) { setScreen("app"); setMode("parent"); setParentView("dashboard"); }
      } catch (err) {
        console.error("Load data error:", err);
        if (!cancelled) setScreen("landing");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authUser, passwordRecovery]);

  /* Load all parent data from Supabase after auth */
  async function loadParentData(user) {
    try {
      const { data: profile, error: profileErr } = await getParentProfile(user.id);
      setParentAccount({
        id: user.id,
        username: profile?.username || user.user_metadata?.username || user.email.split("@")[0],
        email: user.email,
      });
      const { data: kids } = await fetchChildren();
      setChildren((kids || []).map(k => ({
        id: k.id, parentId: k.parent_id, name: k.name, username: k.username,
        pin: "••••",
        colorIdx: k.color_idx, avatar: k.avatar_url,
      })));
      const { data: bks } = await getAllBooks();
      setBooks((bks || []).map(b => ({
        id: b.id, childId: b.child_id, title: b.title, authors: b.authors,
        cover: b.cover_url || makeSvgCover(b.title, b.authors),
        totalPages: b.total_pages, pagesRead: b.pages_read,
        difficulty: b.difficulty, done: b.done,
      })));
      const { data: lg } = await getAllReadingLogs();
      setLogs((lg || []).map(l => ({
        id: l.id, childId: l.child_id, bookTitle: l.book_title,
        pages: l.pages, difficulty: l.difficulty,
        reward: l.reward_type_id, status: l.status,
        date: new Date(l.created_at).toLocaleDateString(),
        adjusted: l.adjusted, originalPages: l.original_pages,
      })));
      const { data: rc } = await getRewardConfigs();
      if (rc && rc.length > 0) {
        setRewards(rc.map(r => ({
          id: r.reward_key, label: r.label, icon: r.icon,
          unit: r.unit, rate: Number(r.rate), color: r.color,
          tiers: r.tiers || [{label:"Small",amount:15},{label:"Medium",amount:30},{label:"Large",amount:60}],
          autoApprove: r.auto_approve || false,
        })));
      }
      const { data: db } = await getDifficultyBonuses();
      if (db && db.length > 0) {
        const bonusMap = {};
        db.forEach(b => { bonusMap[b.difficulty] = { bonusType: b.bonus_type, bonusValue: Number(b.bonus_value) }; });
        setDiffBonuses(bonusMap);
      }
      // Load redemptions
      const { data: rd } = await getAllRedemptions();
      setRedemptions((rd || []).map(r => ({
        id: r.id, childId: r.child_id, rewardTypeId: r.reward_type_id,
        amount: Number(r.amount), tierLabel: r.tier_label,
        status: r.status, date: new Date(r.created_at).toLocaleDateString(),
      })));
      // Load achievements
      const { data: ach } = await getAllAchievements();
      setAchievements((ach || []).map(a => ({
        childId: a.child_id, badgeId: a.badge_key, earnedAt: a.earned_at,
      })));
      // Check push permission after data loads
      const perm = getPushPermission();
      console.log("Push permission on load:", perm);
      setPushPermission(perm);
      // Register SW eagerly (needed for push to work)
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          console.log("Service worker ready");
        } catch (swErr) {
          console.error("SW registration failed:", swErr);
        }
      }
      if (perm === 'default') {
        setTimeout(() => setShowPushPrompt(true), 2000);
      } else if (perm === 'granted') {
        // Already granted — ensure subscription is saved
        try {
          const { subscription, error } = await subscribeToPush();
          console.log("Auto-subscribe result:", { subscription: !!subscription, error });
          if (subscription) {
            const saveResult = await savePushSubscription(subscription);
            console.log("Auto-save result:", saveResult);
          }
        } catch (pushErr) {
          console.error("Auto-subscribe error:", pushErr);
        }
      }
    } catch (err) {
      console.error("loadParentData error:", err);
      setParentAccount({
        id: user.id,
        username: user.user_metadata?.username || user.email.split("@")[0],
        email: user.email,
      });
    }
  }

  /* compute reward points for a log entry */
  function calcPts(pages, difficulty, rewardId, overrideRewards, overrideBonuses) {
    const rList = overrideRewards  || rewards;
    const bList = overrideBonuses  || diffBonuses;
    const r     = rList.find(r=>r.id===rewardId);
    if(!r) return 0;
    const base  = pages * r.rate;
    const bonus = bList[difficulty] || { bonusType:"percent", bonusValue:0 };
    const total = bonus.bonusType==="percent"
      ? base * (1 + bonus.bonusValue/100)
      : base + bonus.bonusValue * pages; // absolute extra per page
    return Math.max(0, Math.round(total / 10));
  }

  // child session: which child is currently logged in to child mode
  const [activeChildId, setActiveChildId]   = useState(null);
  const [childPinInput, setChildPinInput]   = useState("");
  const [childPinError, setChildPinError]   = useState("");
  const [childPickMode, setChildPickMode]   = useState(false); // show child selector

  /* ── signup form ── */
  const [signupForm, setSignupForm] = useState({username:"",email:"",password:"",passwordConfirm:"",error:""});

  /* ── login form ── */
  const [loginForm, setLoginForm] = useState({email:"",password:"",error:""});

  /* ── forgot password ── */
  const [forgotEmail, setForgotEmail]   = useState("");
  const [forgotSent, setForgotSent]     = useState(false);
  const [forgotError, setForgotError]   = useState("");

  /* ── reset password (after clicking email link) ── */
  const [newPassword, setNewPassword]         = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetError, setResetError]           = useState("");

  /* ── app data ── */
  const [children, setChildren]         = useState([]);
  const [books, setBooks]               = useState([]);
  const [logs, setLogs]                 = useState([]);
  const [redemptions, setRedemptions]   = useState([]);
  const [achievements, setAchievements] = useState([]); // [{childId, badgeId, earnedAt}]
  const [newBadge, setNewBadge]         = useState(null); // for celebration popup
  const [pushPermission, setPushPermission] = useState('default'); // 'default'|'granted'|'denied'|'unsupported'
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  /* ── mode inside app ── */
  // mode: "child" | "parent"
  const [mode, setMode]               = useState("child");
  const [childView, setChildView]     = useState("home");
  const [parentView, setParentView]   = useState("dashboard");
  const [detailChildId, setDetailChildId] = useState(null);

  /* ── forms ── */
  const EMPTY_BOOK = {title:"",authors:"",totalPages:"",difficulty:"easy",cover:null,coverFile:null};
  const [addBookForm, setAddBookForm] = useState(EMPTY_BOOK);
  const [logForm, setLogForm]         = useState({book:null,pages:"",reward:""});
  const [confirmLog, setConfirmLog]   = useState(false); // show confirmation before submit
  const [celebrated, setCelebrated]   = useState(null);
  const [parentAdjust, setParentAdjust] = useState({});
  const [redeemReward, setRedeemReward] = useState(null); // which reward type is being redeemed
  const [expandedWeeks, setExpandedWeeks] = useState({}); // {weekKey: true/false}

  const EMPTY_CHILD_FORM = {name:"",username:"",pin:"",pinConfirm:"",colorIdx:0,avatar:"red_suit",error:""};
  const [addChildForm, setAddChildForm] = useState(EMPTY_CHILD_FORM);

  /* ── setup tab ── */
  const [editChildPin, setEditChildPin]   = useState({id:null,pin:"",confirm:"",error:""});

  const coverInputRef  = useRef();

  /* ── derived ── */
  const myChildren = children.filter(c=>c.parentId===parentAccount?.id);
  const activeChild = children.find(c=>c.id===activeChildId);
  const myBooks     = books.filter(b=>b.childId===activeChildId);
  const myActive    = myBooks.filter(b=>!b.done);
  const canAddBook  = myActive.length < MAX_BOOKS;
  const myLogs      = logs.filter(l=>l.childId===activeChildId);
  const myRedemptions = redemptions.filter(r=>r.childId===activeChildId);
  const pendingLogs = logs.filter(l=>l.status==="pending" && myChildren.some(c=>c.id===l.childId));
  const pendingRedemptions = redemptions.filter(r=>r.status==="pending" && myChildren.some(c=>c.id===r.childId));
  const slots       = [0,1,2].map(i=>myActive[i]||null);
  const myEarned    = myLogs.filter(l=>l.status==="approved").reduce((acc,l)=>{
    acc[l.reward]=(acc[l.reward]||0)+calcPts(l.pages, l.difficulty, l.reward);
    return acc;
  },{});
  const myRedeemed = myRedemptions.filter(r=>r.status==="approved").reduce((acc,r)=>{
    acc[r.rewardTypeId]=(acc[r.rewardTypeId]||0)+r.amount;
    return acc;
  },{});
  const earned = rewards.reduce((acc,r)=>{acc[r.id]=myEarned[r.id]||0;return acc;},{});
  const balance = rewards.reduce((acc,r)=>{acc[r.id]=Math.max(0,(myEarned[r.id]||0)-(myRedeemed[r.id]||0));return acc;},{});

  /* ══════════════════════════════════════════════
     AUTH HANDLERS
  ══════════════════════════════════════════════ */
  async function handleSignup() {
    const {username,email,password,passwordConfirm} = signupForm;
    if(!username.trim())            return setSignupForm(f=>({...f,error:"Username is required"}));
    if(!email.includes("@"))        return setSignupForm(f=>({...f,error:"Enter a valid email"}));
    if(password.length<6)           return setSignupForm(f=>({...f,error:"Password must be at least 6 characters"}));
    if(password!==passwordConfirm)  return setSignupForm(f=>({...f,error:"Passwords don't match"}));

    setAuthLoading(true);
    const { data, error } = await signUpParent({ email: email.trim(), password, username: username.trim() });
    setAuthLoading(false);

    if(error) return setSignupForm(f=>({...f,error:error.message}));

    // If email confirmation is enabled, Supabase won't return a session yet
    if(data?.user && !data.session) {
      setSignupForm(f=>({...f,error:""}));
      setScreen("checkEmail");
      return;
    }
    // If session is immediate, onAuthStateChange will fire and the effect will load data
  }

  async function handleLogin() {
    const {email,password} = loginForm;
    if(!email.trim())    return setLoginForm(f=>({...f,error:"Enter your email"}));
    if(!password)        return setLoginForm(f=>({...f,error:"Enter your password"}));

    setAuthLoading(true);
    const { data, error } = await logInParent({ email: email.trim(), password });
    setAuthLoading(false);

    if(error) return setLoginForm(f=>({...f,error:error.message}));
    // onAuthStateChange will fire and the effect will load data + navigate
  }

  async function handleForgotSubmit() {
    if(!forgotEmail.trim()) return setForgotError("Enter your email address");
    setAuthLoading(true);
    const { error } = await resetPassword(forgotEmail.trim());
    setAuthLoading(false);
    if(error) return setForgotError(error.message);
    setForgotSent(true); setForgotError("");
  }

  async function handleResetPassword() {
    if(newPassword.length<6) return setResetError("Password must be at least 6 characters");
    if(newPassword!==newPasswordConfirm) return setResetError("Passwords don't match");
    setAuthLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAuthLoading(false);
    if(error) return setResetError(error.message);
    // Password updated — clear recovery state and load dashboard
    setPasswordRecovery(false);
    setNewPassword(""); setNewPasswordConfirm(""); setResetError("");
    // authUser is already set, so the effect will load data + navigate to dashboard
  }

  async function handleLogout() {
    await logOut();
    setParentAccount(null);
    setChildren([]); setBooks([]); setLogs([]); setRedemptions([]); setAchievements([]);
    setRewards(DEFAULT_REWARDS); setDiffBonuses(DEFAULT_DIFFICULTY_BONUSES);
    setRedeemReward(null);
    setScreen("landing"); setMode("child");
  }

  async function handleEnablePush() {
    setShowPushPrompt(false);
    try {
      const { subscription, error } = await subscribeToPush();
      console.log("Push subscribe result:", { subscription: !!subscription, error });
      if (subscription && !error) {
        const saveResult = await savePushSubscription(subscription);
        console.log("Push save result:", saveResult);
        setPushPermission('granted');
      } else {
        setPushPermission(getPushPermission());
      }
    } catch (err) {
      console.error("Push enable error:", err);
      setPushPermission(getPushPermission());
    }
  }

  async function handleDismissPush() {
    setShowPushPrompt(false);
  }

  function handleChildLogin(child) {
    setChildPinInput(""); setChildPinError(""); setActiveChildId(child.id);
  }

  async function submitChildPin() {
    if(childPinInput.length<4) return setChildPinError("Enter your 4-digit PIN");
    setAuthLoading(true);
    const { valid, error } = await verifyChildPin(activeChildId, childPinInput);
    setAuthLoading(false);
    if(error) { setChildPinError("Something went wrong, try again"); return; }
    if(!valid) { setChildPinError("Wrong PIN, try again"); setChildPinInput(""); return; }
    setChildPinError(""); setChildPickMode(false);
    setMode("child"); setChildView("home");
  }

  function handleParentAccess() {
    setMode("parent"); setParentView("dashboard");
  }

  /* ══════════════════════════════════════════════
     APP HANDLERS
  ══════════════════════════════════════════════ */
  function handleCoverPick(e) {
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>setAddBookForm(form=>({...form,cover:ev.target.result,coverFile:f}));
    r.readAsDataURL(f);
  }
  async function submitAddBook() {
    if(!addBookForm.title.trim()||!addBookForm.totalPages) return;
    setAuthLoading(true);

    // Upload cover image if provided
    let coverUrl = null;
    if (addBookForm.coverFile) {
      const { url, error: uploadErr } = await uploadCover(addBookForm.coverFile, activeChildId);
      if (!uploadErr && url) coverUrl = url;
    }

    const { data: newBook, error } = await addBookToDb({
      childId: activeChildId,
      title: addBookForm.title.trim(),
      authors: addBookForm.authors.trim(),
      coverUrl,
      totalPages: parseInt(addBookForm.totalPages),
      difficulty: addBookForm.difficulty,
    });
    setAuthLoading(false);
    if(error) return;
    setBooks(p=>[...p,{
      id: newBook.id, childId: newBook.child_id,
      title: newBook.title, authors: newBook.authors,
      cover: newBook.cover_url || makeSvgCover(newBook.title, newBook.authors),
      totalPages: newBook.total_pages, pagesRead: 0,
      difficulty: newBook.difficulty, done: false,
    }]);
    setAddBookForm(EMPTY_BOOK); setChildView("home");
  }
  async function submitLog() {
    if(!logForm.pages||!logForm.book) return;
    const pages = parseInt(logForm.pages);
    setAuthLoading(true);
    const { data: newLog, error } = await addLogToDb({
      childId: activeChildId,
      bookId: logForm.book.id,
      bookTitle: logForm.book.title,
      pages,
      difficulty: logForm.book.difficulty,
      rewardTypeId: logForm.reward,
    });
    setAuthLoading(false);
    if(error) return; // TODO: show error
    // Update book pages in Supabase
    const updatedPages = logForm.book.pagesRead + pages;
    await updateBookInDb(logForm.book.id, { pages_read: updatedPages });
    // Update local state
    // Capture data for push notification before resetting form
    const pushChildName = children.find(c=>c.id===activeChildId)?.name || "Your child";
    const pushPages = pages;
    const pushBookTitle = logForm.book.title;
    const pushParentId = parentAccount?.id;

    setBooks(p=>p.map(b=>b.id===logForm.book.id?{...b,pagesRead:updatedPages}:b));
    setLogs(p=>[{
      id: newLog.id, childId: newLog.child_id,
      bookTitle: newLog.book_title, pages: newLog.pages,
      difficulty: newLog.difficulty, reward: newLog.reward_type_id,
      status: "pending", date: "Just now", adjusted: false,
    },...p]);
    setLogForm({book:null,pages:"",reward:rewards[0]?.id||""}); setChildView("home"); setConfirmLog(false);
    checkAchievements(activeChildId);
    // Notify parent
    if (pushParentId) {
      sendPushNotification({
        parentId: pushParentId,
        title: `📖 ${pushChildName} logged reading!`,
        body: `${pushPages} pages of ${pushBookTitle} — waiting for your review.`,
        type: "new_log",
      }).then(r => console.log("Push send result:", r)).catch(err => console.error("Push send error:", err));
    }
  }
  async function markDone(bookId) {
    const book = books.find(b=>b.id===bookId);
    if(!book) return;
    await updateBookInDb(bookId, { done: true, pages_read: book.totalPages });
    setBooks(p=>p.map(b=>b.id===bookId?{...b,done:true,pagesRead:b.totalPages}:b));
    checkAchievements(book.childId);
  }
  async function approveLog(id, overridePages) {
    const log = logs.find(l=>l.id===id);
    if(!log) return;
    setAuthLoading(true);
    const { data: updated, error } = await approveLogInDb(id, overridePages!=null ? overridePages : null);
    setAuthLoading(false);
    if(error) return;
    // Update local state
    const finalPages = overridePages != null ? overridePages : log.pages;
    const finalLog = {
      ...log,
      pages: finalPages,
      status: "approved",
      adjusted: overridePages != null,
      originalPages: overridePages != null ? log.pages : undefined,
    };
    setLogs(p=>p.map(l=>l.id===id?finalLog:l));
    setCelebrated(finalLog); setMode("child"); setChildView("celebrate");
    setActiveChildId(finalLog.childId);
    checkAchievements(finalLog.childId);
  }
  async function rejectLog(id) {
    setAuthLoading(true);
    const { error } = await rejectLogInDb(id);
    setAuthLoading(false);
    if(error) return;
    setLogs(p=>p.map(l=>l.id===id?{...l,status:"rejected"}:l));
  }
  async function submitRedemption(reward, tier) {
    if(balance[reward.id] < tier.amount) return;
    setAuthLoading(true);
    const status = reward.autoApprove ? "approved" : "pending";
    const childName = children.find(c=>c.id===activeChildId)?.name || "Your child";
    const { data: newR, error } = await addRedemptionToDb({
      childId: activeChildId,
      rewardTypeId: reward.id,
      amount: tier.amount,
      tierLabel: tier.label,
      status,
    });
    setAuthLoading(false);
    if(error) return;
    setRedemptions(p=>[{
      id: newR.id, childId: newR.child_id, rewardTypeId: newR.reward_type_id,
      amount: Number(newR.amount), tierLabel: newR.tier_label,
      status: newR.status, date: "Just now",
    },...p]);
    setRedeemReward(null);
    setChildView("home");
    // Notify parent if pending (not auto-approved)
    if (status === "pending" && parentAccount?.id) {
      sendPushNotification({
        parentId: parentAccount.id,
        title: `🎁 ${childName} wants to redeem!`,
        body: `${tier.label} ${reward.label} (${tier.amount} ${reward.unit}) — needs your approval.`,
        type: "new_redemption",
      }).catch(err => console.error("Push error:", err));
    }
  }
  async function approveRedemption(id) {
    setAuthLoading(true);
    const { error } = await approveRedemptionInDb(id);
    setAuthLoading(false);
    if(error) return;
    setRedemptions(p=>p.map(r=>r.id===id?{...r,status:"approved"}:r));
  }
  async function rejectRedemption(id) {
    setAuthLoading(true);
    const { error } = await rejectRedemptionInDb(id);
    setAuthLoading(false);
    if(error) return;
    setRedemptions(p=>p.map(r=>r.id===id?{...r,status:"rejected"}:r));
  }

  /* ── Achievement checker ── */
  async function checkAchievements(childId) {
    const childLogs = logs.filter(l=>l.childId===childId);
    const childBooks = books.filter(b=>b.childId===childId);
    const earned = achievements.filter(a=>a.childId===childId).map(a=>a.badgeId);

    // Compute stats for badge checks
    const totalPages = childLogs.reduce((s,l)=>s+l.pages, 0);
    const totalSessions = childLogs.length;
    const approvedSessions = childLogs.filter(l=>l.status==="approved").length;
    const booksCompleted = childBooks.filter(b=>b.done).length;

    // Compute longest streak
    const today = new Date();
    const ONE_DAY = 86400000;
    const pagesByDay = {};
    childLogs.forEach(l => {
      const d = l.date === "Just now" ? today : new Date(l.date);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      pagesByDay[key] = (pagesByDay[key] || 0) + l.pages;
    });
    const readingDays = Object.entries(pagesByDay)
      .filter(([_, pages]) => pages >= 20)
      .map(([ts]) => Number(ts))
      .sort((a, b) => a - b);
    let longestStreak = 0, tempStreak = 0;
    for (let i = 0; i < readingDays.length; i++) {
      if (i === 0 || readingDays[i] - readingDays[i - 1] === ONE_DAY) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    const stats = { totalPages, totalSessions, approvedSessions, booksCompleted, longestStreak };

    // Check each badge
    let newlyEarned = null;
    for (const badge of BADGES) {
      if (earned.includes(badge.id)) continue;
      if (badge.check(stats)) {
        // Award it
        const { error } = await addAchievementToDb({ childId, badgeKey: badge.id });
        if (!error) {
          setAchievements(p => [...p, { childId, badgeId: badge.id, earnedAt: new Date().toISOString() }]);
          newlyEarned = badge; // show the latest one earned
        }
      }
    }
    if (newlyEarned) {
      setNewBadge(newlyEarned);
      setTimeout(() => setNewBadge(null), 4000);
    }
  }
  async function submitAddChild() {
    const {name,username,pin,pinConfirm,colorIdx,avatar} = addChildForm;
    if(!name.trim())                    return setAddChildForm(f=>({...f,error:"Name required"}));
    if(!username.trim())                return setAddChildForm(f=>({...f,error:"Username required"}));
    if(pin.length<4)                    return setAddChildForm(f=>({...f,error:"PIN must be 4 digits"}));
    if(pin!==pinConfirm)                return setAddChildForm(f=>({...f,error:"PINs don't match"}));
    if(children.some(c=>c.username===username.trim())) return setAddChildForm(f=>({...f,error:"Username taken"}));

    setAuthLoading(true);
    const { hash, error: hashErr } = await hashPin(pin);
    if(hashErr || !hash) { setAuthLoading(false); return setAddChildForm(f=>({...f,error:"Failed to secure PIN, try again"})); }

    const { data: newChild, error: dbErr } = await addChildToDb({
      name: name.trim(), username: username.trim(),
      pinHash: hash, colorIdx, avatarUrl: avatar,  // store character key in avatar_url column
    });
    setAuthLoading(false);

    if(dbErr) return setAddChildForm(f=>({...f,error:dbErr.message}));

    setChildren(p=>[...p,{
      id: newChild.id, parentId: newChild.parent_id,
      name: newChild.name, username: newChild.username,
      pin: "••••", colorIdx: newChild.color_idx,
      avatar: newChild.avatar_url,
    }]);
    setAddChildForm(EMPTY_CHILD_FORM); setParentView("dashboard");
  }
  async function saveChildPin() {
    if(editChildPin.pin.length<4)             return setEditChildPin(f=>({...f,error:"Must be 4 digits"}));
    if(editChildPin.pin!==editChildPin.confirm) return setEditChildPin(f=>({...f,error:"PINs don't match"}));

    setAuthLoading(true);
    const { hash, error: hashErr } = await hashPin(editChildPin.pin);
    if(hashErr || !hash) { setAuthLoading(false); return setEditChildPin(f=>({...f,error:"Failed to secure PIN"})); }

    const { error: dbErr } = await updateChildInDb(editChildPin.id, { pin_hash: hash });
    setAuthLoading(false);

    if(dbErr) return setEditChildPin(f=>({...f,error:dbErr.message}));

    setEditChildPin({id:null,pin:"",confirm:"",error:""});
  }



  /* ══ LOADING ══════════════════════════════════════════════════ */
  if(screen==="loading") return (
    <Wrap>
      <div className="loading-screen">
        <div className="landing-icon float">📚</div>
        <div className="loading-text">Loading…</div>
      </div>
    </Wrap>
  );

  /* ══ LANDING ══════════════════════════════════════════════════ */
  if(screen==="landing") return (
    <Wrap>
      <div className="landing">
        <div className="landing-icon float">📚</div>
        <div className="landing-title">ReadReward</div>
        <div className="landing-subtitle">Read more. Earn more.</div>
        <div className="landing-actions">
          <button className="btn btn-primary" onClick={()=>setScreen("parentLogin")}>
            👨‍👩‍👧 Parent Login
          </button>
          <button className="btn btn-secondary" onClick={()=>setScreen("parentSignup")}>
            ✨ Create Parent Account
          </button>
          <div className="landing-divider">— or —</div>
          <button className="btn btn-primary btn-orange" onClick={()=>{ setScreen("app"); setChildPickMode(true); }} style={{padding:"14px 0",fontSize:15}}>
            👧 I'm a Child — Log In
          </button>
        </div>
      </div>
    </Wrap>
  );

  /* ══ PARENT SIGNUP ════════════════════════════════════════════ */
  if(screen==="parentSignup") return (
    <Wrap>
      <div className="auth-page">
        <button className="btn btn-ghost" onClick={()=>setScreen("landing")} style={{marginBottom:24}}>← Back</button>
        <div className="auth-title">Create Account</div>
        <div className="auth-subtitle">Set up your parent account</div>

        <div className="auth-form">
          <div><div className="slabel">USERNAME</div>
            <input className="ifield" placeholder="e.g. ThompsonFamily" value={signupForm.username} onChange={e=>setSignupForm(f=>({...f,username:e.target.value,error:""}))}/>
          </div>
          <div><div className="slabel">EMAIL</div>
            <input className="ifield" type="email" placeholder="your@email.com" value={signupForm.email} onChange={e=>setSignupForm(f=>({...f,email:e.target.value,error:""}))}/>
          </div>
          <div><div className="slabel">PASSWORD</div>
            <input className="ifield" type="password" placeholder="At least 6 characters" value={signupForm.password} onChange={e=>setSignupForm(f=>({...f,password:e.target.value,error:""}))}/>
          </div>
          <div><div className="slabel">CONFIRM PASSWORD</div>
            <input className="ifield" type="password" placeholder="Re-enter password" value={signupForm.passwordConfirm} onChange={e=>setSignupForm(f=>({...f,passwordConfirm:e.target.value,error:""}))}/>
          </div>
          {signupForm.error&&<div className="auth-error">{signupForm.error}</div>}
          <button className={`btn btn-primary ${authLoading?"btn-loading":""}`} onClick={handleSignup} disabled={authLoading} style={{marginTop:8}}>
            {authLoading?"Creating account…":"Create Account →"}
          </button>
          <div className="auth-footer">Already have an account? <span className="auth-link" onClick={()=>setScreen("parentLogin")}>Log in</span></div>
        </div>
      </div>
    </Wrap>
  );

  /* ══ CHECK EMAIL (after signup with confirmation enabled) ═══ */
  if(screen==="checkEmail") return (
    <Wrap>
      <div className="check-email">
        <div className="check-email-icon">📧</div>
        <div className="check-email-title">Check your email!</div>
        <div className="check-email-body">
          We've sent a confirmation link to <strong style={{color:"#fff"}}>{signupForm.email}</strong>. Click the link to activate your account.
        </div>
        <div className="check-email-hint">Check your spam folder if you don't see it.</div>
        <button className="btn btn-primary" onClick={()=>{setScreen("parentLogin");setLoginForm({email:signupForm.email,password:"",error:""});}} style={{padding:"14px 36px",fontSize:15}}>
          Go to Login →
        </button>
      </div>
    </Wrap>
  );

  /* ══ PARENT LOGIN ═════════════════════════════════════════════ */
  if(screen==="parentLogin") return (
    <Wrap>
      <div className="auth-page">
        <button className="btn btn-ghost" onClick={()=>setScreen("landing")} style={{marginBottom:24}}>← Back</button>
        <div className="auth-title">Welcome back</div>
        <div className="auth-subtitle">Log in to your parent account</div>

        <div className="auth-form">
          <div><div className="slabel">EMAIL</div>
            <input className="ifield" type="email" placeholder="your@email.com" value={loginForm.email} onChange={e=>setLoginForm(f=>({...f,email:e.target.value,error:""}))}/>
          </div>
          <div><div className="slabel">PASSWORD</div>
            <input className="ifield" type="password" placeholder="Your password" value={loginForm.password} onChange={e=>setLoginForm(f=>({...f,password:e.target.value,error:""}))}/>
          </div>
          {loginForm.error&&<div className="auth-error">{loginForm.error}</div>}
          <button className={`btn btn-primary ${authLoading?"btn-loading":""}`} onClick={handleLogin} disabled={authLoading} style={{marginTop:8}}>
            {authLoading?"Logging in…":"Log In →"}
          </button>
          <div style={{textAlign:"center"}}>
            <span className="auth-link" style={{fontSize:13}} onClick={()=>{setForgotEmail("");setForgotSent(false);setForgotError("");setScreen("forgotPassword");}}>Forgot password?</span>
          </div>
          <div className="auth-footer">No account? <span className="auth-link" onClick={()=>setScreen("parentSignup")}>Sign up</span></div>
        </div>
      </div>
    </Wrap>
  );

  /* ══ FORGOT PASSWORD ════════════════════════════════════════════ */
  if(screen==="forgotPassword") return (
    <Wrap>
      <div className="auth-page">
        <button className="btn btn-ghost" onClick={()=>setScreen("parentLogin")} style={{marginBottom:24}}>← Back</button>
        <div className="auth-title">Forgot password?</div>
        <div className="auth-subtitle">We'll send a reset link to your email</div>

        {!forgotSent ? (
          <div className="auth-form">
            <div><div className="slabel">YOUR EMAIL ADDRESS</div>
              <input className="ifield" type="email" placeholder="your@email.com" value={forgotEmail} onChange={e=>{setForgotEmail(e.target.value);setForgotError("");}}/>
            </div>
            {forgotError&&<div className="auth-error">{forgotError}</div>}
            <button className={`btn btn-primary ${authLoading?"btn-loading":""}`} onClick={handleForgotSubmit} disabled={authLoading}>
              {authLoading?"Sending…":"Send Reset Link →"}
            </button>
          </div>
        ) : (
          <div className="fade reset-success">
            <div className="reset-success-icon">📧</div>
            <div className="reset-success-title">Check your email!</div>
            <div className="reset-success-body">
              We've sent a password reset link to <strong style={{color:"#fff"}}>{forgotEmail}</strong>.
            </div>
            <div className="reset-success-hint">Click the link in the email to set a new password. Check spam if you don't see it.</div>
            <button className="btn btn-primary" onClick={()=>{setScreen("parentLogin");setLoginForm({email:forgotEmail,password:"",error:""});}} style={{padding:"14px 36px",fontSize:15}}>
              Back to Login →
            </button>
          </div>
        )}
      </div>
    </Wrap>
  );

  /* ══ RESET PASSWORD (after clicking email link) ═══════════════ */
  if(screen==="resetPassword") return (
    <Wrap>
      <div className="auth-page">
        <div className="reset-title">Set New Password</div>
        <div className="reset-subtitle">Choose a new password for your account</div>

        <div className="auth-form">
          <div><div className="slabel">NEW PASSWORD</div>
            <input className="ifield" type="password" placeholder="At least 6 characters" value={newPassword} onChange={e=>{setNewPassword(e.target.value);setResetError("");}}/>
          </div>
          <div><div className="slabel">CONFIRM NEW PASSWORD</div>
            <input className="ifield" type="password" placeholder="Re-enter password" value={newPasswordConfirm} onChange={e=>{setNewPasswordConfirm(e.target.value);setResetError("");}}/>
          </div>
          {resetError&&<div className="auth-error">{resetError}</div>}
          <button className={`btn btn-green ${authLoading?"btn-loading":""}`} onClick={handleResetPassword} disabled={authLoading} style={{marginTop:8}}>
            {authLoading?"Saving…":"Save New Password →"}
          </button>
        </div>
      </div>
    </Wrap>
  );

  /* ══ APP — CHILD PICK / PIN SCREEN ════════════════════════════ */
  if(screen==="app" && (childPickMode || (!activeChildId && mode==="child"))) return (
    <Wrap>
      <div className="auth-page">
        {/* parent escape */}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
          <button className="btn btn-ghost-sm" onClick={()=>{
            if(parentAccount) { setChildPickMode(false); setMode("parent"); setParentView("dashboard"); }
            else { setScreen("parentLogin"); setLoginForm({email:"",password:"",error:""}); }
          }}>👨‍👩‍👧 {parentAccount?"Parent Dashboard":"Parent login"}</button>
        </div>

        {!activeChildId ? (
          <>
            <div style={{textAlign:"center",marginBottom:28}}>
              <div className="child-picker-title">Who's reading? 📚</div>
              <div className="child-picker-subtitle">Tap your name to log in</div>
            </div>
            <div className="child-picker-list">
              {myChildren.map(child=>(
                <button key={child.id} className="btn child-picker-btn" onClick={()=>handleChildLogin(child)} style={{border:`1px solid ${AVATAR_COLORS[child.colorIdx||0][0]}44`}}>
                  <Avatar child={child} size={48} ring/>
                  <div>
                    <div className="child-picker-name">{child.name}</div>
                    <div className="child-picker-username">@{child.username}</div>
                  </div>
                  <div className="child-picker-arrow">→</div>
                </button>
              ))}
              {myChildren.length===0&&<div className="child-picker-empty">No children added yet.<br/>Ask a parent to set up your account.</div>}
            </div>
          </>
        ) : (
          <>
            <div className="child-pin-header">
              <div className="child-pin-avatar"><Avatar child={activeChild} size={64} ring/></div>
              <div className="child-pin-name">Hi, {activeChild?.name}! 👋</div>
              <div className="child-pin-hint">Enter your 4-digit PIN</div>
            </div>
            <PinPad length={4} value={childPinInput} onChange={v=>{setChildPinInput(v);setChildPinError("");}} error={childPinError}/>
            <button className={`btn btn-primary btn-orange ${authLoading?"btn-loading":""}`} onClick={submitChildPin} disabled={authLoading} style={{width:"100%",marginTop:24}}>
              {authLoading?"Checking…":"Let's Read! →"}
            </button>
            <button className="child-pin-back" onClick={()=>setActiveChildId(null)}>← Back to child select</button>
          </>
        )}
      </div>
    </Wrap>
  );

  /* ══ MAIN APP ═════════════════════════════════════════════════ */
  return (
    <Wrap>
      {/* HEADER */}
      <div className="app-header">
        <div>
          <div className="app-header-brand">📚 ReadReward</div>
          <div className="app-header-tagline">Read more. Earn more.</div>
        </div>
        <div className="app-header-actions">
          {mode==="child" && activeChild && (
            <div className="app-header-actions">
              <Avatar child={activeChild} size={32} ring/>
              <button className="btn btn-ghost-sm" onClick={handleParentAccess}>👨‍👩‍👧</button>
            </div>
          )}
          {mode==="parent" && (
            <button className="btn btn-ghost-sm" onClick={()=>{setChildPickMode(true);setActiveChildId(null);setMode("child");}}>👧 Kids</button>
          )}
        </div>
      </div>

      <div className="app-content">

        {/* ════ CHILD MODE ════ */}
        {mode==="child" && activeChild && (
          <>
            {/* HOME */}
            {childView==="home" && (
              <>
                <div className="child-shelf-header">
                  <Avatar child={activeChild} size={44} ring/>
                  <div>
                    <div className="child-shelf-name">{activeChild.name}'s shelf</div>
                    <div className="child-shelf-sub">Keep reading, keep earning! 🌟</div>
                  </div>
                </div>
                <div className="card pop reward-bank">
                  <div className="slabel">YOUR REWARD BANK</div>
                  <div className="reward-grid">{rewards.map(r=><div key={r.id} onClick={()=>balance[r.id]>0&&setRedeemReward(r)} style={{cursor:balance[r.id]>0?"pointer":"default"}}><RewardPill reward={r} earned={balance[r.id]}/></div>)}</div>
                  {rewards.some(r=>balance[r.id]>0)&&<div className="reward-tap-hint">Tap a reward to spend it!</div>}
                </div>

                {/* REDEEM MODAL */}
                {redeemReward && (
                  <div className="card pop redeem-modal" style={{border:`2px solid ${redeemReward.color}55`}}>
                    <div className="redeem-header">
                      <div className="redeem-title">{redeemReward.icon} Spend {redeemReward.label}</div>
                      <button className="redeem-close" onClick={()=>setRedeemReward(null)}>✕</button>
                    </div>
                    <div className="redeem-balance">
                      Balance: <span style={{color:redeemReward.color,fontWeight:800}}>{balance[redeemReward.id]} {redeemReward.unit}</span>
                      {!redeemReward.autoApprove && <span> · Needs parent approval</span>}
                      {redeemReward.autoApprove && <span style={{color:"#27AE60"}}> · Auto-approved</span>}
                    </div>
                    <div className="redeem-tiers">
                      {(redeemReward.tiers||[]).map((tier,i)=>{
                        const canAfford = balance[redeemReward.id] >= tier.amount;
                        return <button key={i} className="btn" disabled={!canAfford||authLoading} onClick={()=>submitRedemption(redeemReward,tier)} style={{padding:"16px 8px",background:canAfford?redeemReward.color+"25":"rgba(255,255,255,0.04)",border:canAfford?`2px solid ${redeemReward.color}50`:"2px solid rgba(255,255,255,0.08)",color:canAfford?"#fff":"rgba(255,255,255,0.2)",opacity:canAfford?1:0.5,cursor:canAfford?"pointer":"not-allowed"}}>
                          <div style={{fontSize:11,fontWeight:700,marginBottom:4}}>{tier.label}</div>
                          <div style={{fontSize:22,fontWeight:900,color:canAfford?redeemReward.color:"rgba(255,255,255,0.2)"}}>{tier.amount}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{redeemReward.unit}</div>
                        </button>;
                      })}
                    </div>
                  </div>
                )}

                <div className="card" style={{padding:14,marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div className="slabel" style={{margin:0}}>MY READING LIST ({myActive.length}/{MAX_BOOKS})</div>
                    {!canAddBook&&<span style={{fontSize:10,color:"#FF6B35",fontWeight:700}}>Finish a book first!</span>}
                  </div>
                  <div style={{display:"flex",gap:8}}>{slots.map((b,i)=><BookSlot key={i} book={b} onMarkDone={markDone} onLogReading={b=>{ setLogForm({book:b,pages:"",reward:rewards[0]?.id||""}); setConfirmLog(false); setChildView("logReading"); }}/>)}</div>
                  <button className="btn" onClick={()=>canAddBook&&setChildView("addBook")} style={{width:"100%",marginTop:10,padding:"11px 0",fontSize:14,background:canAddBook?"linear-gradient(135deg,#4776E6,#8E54E9)":"rgba(255,255,255,0.05)",color:canAddBook?"#fff":"rgba(255,255,255,0.25)",cursor:canAddBook?"pointer":"not-allowed",boxShadow:canAddBook?"0 4px 16px rgba(71,118,230,0.35)":"none"}}>
                    {canAddBook?"＋ Add a Book":"🔒 Complete a book first"}
                  </button>
                </div>
                {/* YTD pages (approved only) */}
                {(()=>{
                  const now = new Date();
                  const yearStart = new Date(now.getFullYear(), 0, 1);
                  const ytdPages = myLogs.filter(l=>l.status==="approved").reduce((sum, l) => {
                    const d = l.date === "Just now" ? now : new Date(l.date);
                    return d >= yearStart ? sum + l.pages : sum;
                  }, 0);
                  return <div className="card" style={{padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",fontWeight:700}}>📖 Year to date ({now.getFullYear()})</div>
                    <div style={{fontSize:18,fontWeight:900,color:"#4776E6"}}>{ytdPages} pages</div>
                  </div>;
                })()}

                {/* Weekly grouped activity */}
                {(()=>{
                  const now = new Date();
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const ONE_DAY = 86400000;
                  const currentWeekKey = (()=>{ const d=new Date(today); const day=d.getDay(); d.setDate(d.getDate()-(day===0?6:day-1)); return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(); })();

                  function getMonday(d) {
                    const dt = new Date(d);
                    const day = dt.getDay();
                    dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
                    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                  }

                  function fmtShort(d) {
                    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                    return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
                  }

                  function fmtDateTime(d) {
                    const dd = String(d.getDate()).padStart(2,"0");
                    const mm = String(d.getMonth()+1).padStart(2,"0");
                    const hh = String(d.getHours()).padStart(2,"0");
                    const mi = String(d.getMinutes()).padStart(2,"0");
                    return `${dd}/${mm} ${hh}:${mi}`;
                  }

                  const allItems = [
                    ...myLogs.map(log => {
                      const r = rewards.find(r=>r.id===log.reward) || {id:"?",label:"Reward",icon:"🎯",unit:"mins",rate:1,color:"#888"};
                      const pts = calcPts(log.pages, log.difficulty, log.reward);
                      const d = log.date === "Just now" ? now : new Date(log.date);
                      return { type:"log", d, pages: log.status==="approved" ? log.pages : 0, node: (
                        <div key={log.id} className="card" style={{padding:"10px 12px",marginBottom:5,display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontSize:18}}>{log.status==="approved"?"✅":log.status==="pending"?"⏳":"❌"}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:800,fontSize:13}}>{log.bookTitle}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:1}}>{log.pages}pp · {log.difficulty} · {fmtDateTime(d)}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:12,fontWeight:900,color:r.color}}>{r.icon} +{pts}{r.unit==="p"?"p":` ${r.unit}`}</div>
                            <Badge color={log.status==="approved"?"#27AE60":log.status==="pending"?"#F39C12":"#E74C3C"}>{log.status}</Badge>
                          </div>
                        </div>
                      )};
                    }),
                    ...myRedemptions.map(rd => {
                      const r = rewards.find(r=>r.id===rd.rewardTypeId) || {id:"?",label:"Reward",icon:"🎯",unit:"mins",rate:1,color:"#888"};
                      const d = rd.date === "Just now" ? now : new Date(rd.date);
                      return { type:"redemption", d, pages: 0, node: (
                        <div key={rd.id} className="card" style={{padding:"10px 12px",marginBottom:5,display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontSize:18}}>{rd.status==="approved"?"🎁":rd.status==="pending"?"⏳":"❌"}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:800,fontSize:13}}>Redeemed {rd.tierLabel||""}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:1}}>{r.label} · {fmtDateTime(d)}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:12,fontWeight:900,color:r.color}}>{r.icon} −{rd.amount}{r.unit==="p"?"p":` ${r.unit}`}</div>
                            <Badge color={rd.status==="approved"?"#27AE60":rd.status==="pending"?"#F39C12":"#E74C3C"}>{rd.status}</Badge>
                          </div>
                        </div>
                      )};
                    }),
                  ].sort((a,b) => b.d - a.d);

                  const weekMap = {};
                  allItems.forEach(item => {
                    const mon = getMonday(item.d).getTime();
                    if (!weekMap[mon]) weekMap[mon] = { items: [], approvedPages: 0 };
                    weekMap[mon].items.push(item);
                    weekMap[mon].approvedPages += item.pages; // only approved logs contribute pages
                  });

                  const weekKeys = Object.keys(weekMap).sort((a,b) => Number(b) - Number(a)).slice(0, 8);

                  return weekKeys.length > 0 ? weekKeys.map((key, idx) => {
                    const mon = new Date(Number(key));
                    const sun = new Date(mon.getTime() + 6 * ONE_DAY);
                    const week = weekMap[key];
                    const isCurrentWeek = Number(key) === currentWeekKey;
                    const isExpanded = expandedWeeks[key] !== undefined ? expandedWeeks[key] : isCurrentWeek;
                    return (
                      <div key={key} style={{marginBottom:12}}>
                        <div onClick={()=>setExpandedWeeks(p=>({...p,[key]:!isExpanded}))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(255,255,255,0.05)",borderRadius:12,cursor:"pointer",border:isCurrentWeek?"1px solid rgba(255,107,53,0.25)":"1px solid transparent"}}>
                          <div>
                            <div style={{fontSize:12,fontWeight:800,color:isCurrentWeek?"#FF6B35":"rgba(255,255,255,0.6)"}}>
                              {isCurrentWeek?"This week":"Week"}: {fmtShort(mon)} – {fmtShort(sun)}
                            </div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{week.items.length} {week.items.length===1?"activity":"activities"}</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{fontSize:14,fontWeight:900,color:isCurrentWeek?"#FF6B35":"#4776E6"}}>{week.approvedPages}pp</div>
                            <div style={{fontSize:14,color:"rgba(255,255,255,0.3)",transform:isExpanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▾</div>
                          </div>
                        </div>
                        {isExpanded && <div style={{marginTop:6}}>{week.items.map(item => item.node)}</div>}
                      </div>
                    );
                  }) : <div className="card" style={{padding:28,textAlign:"center",color:"rgba(255,255,255,0.3)"}}><div style={{fontSize:36,marginBottom:8}}>📖</div>No activity yet — start reading!</div>;
                })()}
              </>
            )}

            {/* ADD BOOK */}
            {childView==="addBook" && (
              <div className="pop">
                <button className="btn" onClick={()=>{setChildView("home");setAddBookForm(EMPTY_BOOK);}} style={{background:"rgba(255,255,255,0.1)",color:"#fff",padding:"7px 14px",marginBottom:16,fontSize:14}}>← Back</button>
                <div style={{fontSize:20,fontWeight:900,marginBottom:18}}>📖 Add a New Book</div>
                <div style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:16}}>
                  <div onClick={()=>coverInputRef.current?.click()} style={{width:90,flexShrink:0,cursor:"pointer",borderRadius:10,overflow:"hidden",border:addBookForm.cover?"2px solid rgba(255,255,255,0.25)":"2px dashed rgba(255,255,255,0.2)",position:"relative"}}>
                    <div style={{paddingBottom:"144%",position:"relative"}}><div style={{position:"absolute",inset:0}}>
                      {addBookForm.cover?<img src={addBookForm.cover} alt="cover" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                        :<div style={{width:"100%",height:"100%",background:"rgba(255,255,255,0.05)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}><div style={{fontSize:26}}>📷</div><div style={{fontSize:10,color:"rgba(255,255,255,0.35)",textAlign:"center",lineHeight:1.3}}>Tap to add cover</div></div>}
                    </div></div>
                    {addBookForm.cover&&<div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.55)",padding:"4px 0",textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.7)"}}>📷 Change</div>}
                  </div>
                  <input ref={coverInputRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleCoverPick}/>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
                    <div><div className="slabel">BOOK TITLE *</div><input className="ifield" placeholder="e.g. The Hobbit" value={addBookForm.title} onChange={e=>setAddBookForm(f=>({...f,title:e.target.value}))}/></div>
                    <div><div className="slabel">AUTHOR</div><input className="ifield" placeholder="e.g. J.R.R. Tolkien" value={addBookForm.authors} onChange={e=>setAddBookForm(f=>({...f,authors:e.target.value}))}/></div>
                  </div>
                </div>
                <div className="card" style={{padding:16,marginBottom:14}}><div className="slabel">TOTAL PAGES *</div><input className="ifield" type="number" placeholder="e.g. 310" value={addBookForm.totalPages} onChange={e=>setAddBookForm(f=>({...f,totalPages:e.target.value}))} style={{textAlign:"center",fontSize:26,fontWeight:900}}/></div>
                <div className="card" style={{padding:16,marginBottom:20}}><div className="slabel">DIFFICULTY</div>
                  <div style={{display:"flex",gap:8}}>{Object.entries(DIFFICULTY_LABELS).map(([key,label])=>(
                    <button key={key} className="btn" onClick={()=>setAddBookForm(f=>({...f,difficulty:key}))} style={{flex:1,padding:"12px 0",background:addBookForm.difficulty===key?"rgba(255,107,53,0.28)":"rgba(255,255,255,0.06)",border:addBookForm.difficulty===key?"2px solid #FF6B35":"2px solid transparent",color:"#fff",fontSize:13}}>
                      {label}<div style={{fontSize:11,color:"#FF6B35",marginTop:3}}>{diffBonuses[key]?.bonusType==="percent" ? `+${diffBonuses[key].bonusValue}%` : `+${diffBonuses[key]?.bonusValue||0} per page`}</div>
                    </button>
                  ))}</div>
                </div>
                <button className="btn" onClick={submitAddBook} disabled={authLoading} style={{width:"100%",padding:"15px 0",fontSize:16,background:addBookForm.title&&addBookForm.totalPages?"linear-gradient(135deg,#27AE60,#2ECC71)":"rgba(255,255,255,0.07)",color:"#fff",opacity:authLoading?0.6:1}}>{authLoading?"Saving…":"📚 Add to My Reading List"}</button>
              </div>
            )}

            {/* LOG READING */}
            {childView==="logReading" && logForm.book && (
              <div className="pop">
                <button className="btn" onClick={()=>setChildView("home")} style={{background:"rgba(255,255,255,0.1)",color:"#fff",padding:"7px 14px",marginBottom:14,fontSize:14}}>← Back</button>
                <div style={{fontSize:20,fontWeight:900,marginBottom:14}}>📖 Log Reading Session</div>
                <div className="card" style={{padding:14,marginBottom:12,display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:52,flexShrink:0,borderRadius:8,overflow:"hidden"}}><div style={{paddingBottom:"144%",position:"relative"}}><img src={logForm.book.cover} alt={logForm.book.title} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/></div></div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:900,fontSize:16}}>{logForm.book.title}</div>
                    {logForm.book.authors&&<div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{logForm.book.authors}</div>}
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:4}}>{logForm.book.pagesRead}/{logForm.book.totalPages} pages so far</div>
                    <div style={{marginTop:8,background:"rgba(255,255,255,0.08)",borderRadius:20,height:5}}><div style={{height:"100%",borderRadius:20,width:`${Math.min(100,(logForm.book.pagesRead/logForm.book.totalPages)*100)}%`,background:"linear-gradient(90deg,#FF6B35,#FF8E53)"}}/></div>
                  </div>
                </div>
                <div className="card" style={{padding:16,marginBottom:12}}><div className="slabel">PAGES READ TODAY</div><input className="ifield" type="number" placeholder="e.g. 20" value={logForm.pages} onChange={e=>setLogForm(f=>({...f,pages:e.target.value}))} style={{textAlign:"center",fontSize:28,fontWeight:900}}/></div>
                <div className="card" style={{padding:16,marginBottom:18}}><div className="slabel">I WANT TO EARN…</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{rewards.map(r=>{
                    const pts=logForm.pages?calcPts(parseInt(logForm.pages), logForm.book.difficulty, r.id):"?";
                    return <button key={r.id} className="btn" onClick={()=>setLogForm(f=>({...f,reward:r.id}))} style={{padding:"13px 6px",background:logForm.reward===r.id?r.color+"30":"rgba(255,255,255,0.06)",border:logForm.reward===r.id?`2px solid ${r.color}`:"2px solid transparent",color:"#fff",fontSize:12}}>
                      <div style={{fontSize:20}}>{r.icon}</div><div style={{fontWeight:800,marginTop:3,fontSize:11}}>{r.label}</div><div style={{fontSize:14,fontWeight:900,color:r.color,marginTop:3}}>{pts}{r.unit==="p"?"p":` ${r.unit}`}</div>
                    </button>;
                  })}</div>
                </div>

                {/* Confirmation */}
                {!confirmLog ? (
                  <button className="btn" onClick={()=>{if(logForm.pages)setConfirmLog(true);}} style={{width:"100%",padding:"15px 0",fontSize:16,background:logForm.pages?"linear-gradient(135deg,#4776E6,#8E54E9)":"rgba(255,255,255,0.07)",color:"#fff"}}>
                    Review & Submit →
                  </button>
                ) : (()=>{
                  const selReward = rewards.find(r=>r.id===logForm.reward) || rewards[0] || {id:"?",label:"Reward",icon:"🎯",unit:"mins",rate:1,color:"#888"};
                  const confirmPts = calcPts(parseInt(logForm.pages), logForm.book.difficulty, selReward.id);
                  return <div className="card pop" style={{padding:16,marginBottom:10,border:`2px solid ${selReward.color}44`}}>
                    <div style={{fontWeight:900,fontSize:15,marginBottom:12,textAlign:"center"}}>Confirm your reading log</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"rgba(255,255,255,0.5)"}}>Book</span><span style={{fontWeight:700}}>{logForm.book.title}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"rgba(255,255,255,0.5)"}}>Pages read</span><span style={{fontWeight:700}}>{logForm.pages} pages</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"rgba(255,255,255,0.5)"}}>Difficulty</span><span style={{fontWeight:700}}>{logForm.book.difficulty}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:8}}>
                        <span style={{color:"rgba(255,255,255,0.5)"}}>Reward</span>
                        <span style={{fontWeight:900,color:selReward.color}}>{selReward.icon} {confirmPts}{selReward.unit==="p"?"p":` ${selReward.unit}`} of {selReward.label}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="btn" onClick={submitLog} disabled={authLoading} style={{flex:2,padding:"13px 0",fontSize:15,background:"linear-gradient(135deg,#FF6B35,#FF8E53)",color:"#fff",opacity:authLoading?0.6:1}}>
                        {authLoading?"Submitting…":"🚀 Submit!"}
                      </button>
                      <button className="btn" onClick={()=>setConfirmLog(false)} style={{flex:1,padding:"13px 0",fontSize:13,background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)"}}>Edit</button>
                    </div>
                  </div>;
                })()}
              </div>
            )}

            {/* CELEBRATE */}
            {childView==="celebrate" && celebrated && (()=>{
              const r=rewards.find(r=>r.id===celebrated.reward) || {id:"?",label:"Reward",icon:"🎯",unit:"mins",rate:1,color:"#888"};
              const pts=calcPts(celebrated.pages, celebrated.difficulty, celebrated.reward);
              const child=children.find(c=>c.id===celebrated.childId);
              return <div className="pop" style={{textAlign:"center",padding:"36px 10px"}}>
                {child&&<div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Avatar child={child} size={56} ring/></div>}
                <div style={{fontSize:76,animation:"float 2s ease-in-out infinite"}}>🎉</div>
                <div style={{fontSize:26,fontWeight:900,margin:"18px 0 8px"}}>{child?.name}, awesome reading!</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:celebrated.adjusted?8:26}}>{celebrated.bookTitle} — {celebrated.pages} pages approved!</div>
                {celebrated.adjusted&&<div style={{fontSize:12,color:"#F59E0B",marginBottom:20,fontWeight:700}}>⚡ Adjusted from {celebrated.originalPages} pages</div>}
                <div style={{background:r.color+"20",border:`2px solid ${r.color}40`,borderRadius:22,padding:"26px 34px",marginBottom:26,display:"inline-block"}}>
                  <div style={{fontSize:50}}>{r.icon}</div><div style={{fontSize:42,fontWeight:900,color:r.color}}>{pts}</div>
                  <div style={{fontSize:15,color:"rgba(255,255,255,0.6)"}}>{r.unit==="p"?"pence earned":`${r.unit} of ${r.label}`}</div>
                </div><br/>
                <button className="btn" onClick={()=>{setCelebrated(null);setChildView("home");}} style={{background:"linear-gradient(135deg,#FF6B35,#FF8E53)",color:"#fff",padding:"14px 36px",fontSize:16}}>🏠 Back to Home</button>
              </div>;
            })()}

            {/* STATS */}
            {childView==="stats" && (()=>{
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const ONE_DAY = 86400000;
              const approvedLogs = myLogs.filter(l=>l.status==="approved");

              // Streaks use ALL submitted logs (per rules)
              const pagesByDayAll = {};
              myLogs.forEach(l => {
                const d = l.date === "Just now" ? today : new Date(l.date);
                const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                pagesByDayAll[key] = (pagesByDayAll[key] || 0) + l.pages;
              });
              const readingDays = Object.entries(pagesByDayAll)
                .filter(([_, pages]) => pages >= 20)
                .map(([ts]) => Number(ts))
                .sort((a, b) => b - a);
              let streak = 0;
              let checkDate = today.getTime();
              if (!readingDays.includes(checkDate)) checkDate -= ONE_DAY;
              while (readingDays.includes(checkDate)) { streak++; checkDate -= ONE_DAY; }
              let longestStreak = 0, tempStreak = 0;
              const sortedDays = [...readingDays].sort((a, b) => a - b);
              for (let i = 0; i < sortedDays.length; i++) {
                if (i === 0 || sortedDays[i] - sortedDays[i - 1] === ONE_DAY) { tempStreak++; }
                else { tempStreak = 1; }
                longestStreak = Math.max(longestStreak, tempStreak);
              }

              // Weekly pages use APPROVED only
              const weeks = [];
              for (let w = 0; w < 4; w++) {
                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() - (w * 7));
                const weekStart = new Date(weekEnd);
                weekStart.setDate(weekStart.getDate() - 6);
                let wp = 0;
                approvedLogs.forEach(l => {
                  const d = l.date === "Just now" ? today : new Date(l.date);
                  if (d >= weekStart && d <= new Date(weekEnd.getTime() + ONE_DAY)) wp += l.pages;
                });
                weeks.unshift({ label: w === 0 ? "This week" : w === 1 ? "Last week" : `${w}w ago`, pages: wp });
              }
              const maxPages = Math.max(...weeks.map(w => w.pages), 1);

              // Totals use APPROVED only for pages
              const totalPages = approvedLogs.reduce((sum, l) => sum + l.pages, 0);
              const booksCompleted = myBooks.filter(b => b.done).length;
              const totalSessions = myLogs.length;
              const thisWeekSessions = myLogs.filter(l => {
                const d = l.date === "Just now" ? today : new Date(l.date);
                const weekAgo = new Date(today.getTime() - 7 * ONE_DAY);
                return d >= weekAgo;
              }).length;
              const lastWeekSessions = myLogs.filter(l => {
                const d = l.date === "Just now" ? today : new Date(l.date);
                const weekAgo = new Date(today.getTime() - 7 * ONE_DAY);
                const twoWeeksAgo = new Date(today.getTime() - 14 * ONE_DAY);
                return d >= twoWeeksAgo && d < weekAgo;
              }).length;
              const sessionDiff = thisWeekSessions - lastWeekSessions;

              return <div className="pop">
                <button className="btn" onClick={() => setChildView("home")} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "7px 14px", marginBottom: 16, fontSize: 14 }}>← Back</button>
                <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 18 }}>📊 My Reading Stats</div>

                {/* Streak */}
                <div className="card" style={{ padding: 18, marginBottom: 14, textAlign: "center", background: streak > 0 ? "linear-gradient(135deg,rgba(255,107,53,0.15),rgba(255,142,83,0.1))" : undefined, border: streak > 0 ? "1px solid rgba(255,107,53,0.3)" : undefined }}>
                  <div style={{ fontSize: 48 }}>{streak > 0 ? "🔥" : "💤"}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: streak > 0 ? "#FF6B35" : "rgba(255,255,255,0.3)", marginTop: 4 }}>{streak}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>day streak</div>
                  {longestStreak > streak && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>Best: {longestStreak} days</div>}
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>Read 20+ pages daily to keep it going!</div>
                </div>

                {/* Quick stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                  <div className="card" style={{ padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#4776E6" }}>{totalPages}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>TOTAL PAGES</div>
                  </div>
                  <div className="card" style={{ padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#27AE60" }}>{booksCompleted}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>BOOKS DONE</div>
                  </div>
                  <div className="card" style={{ padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#9B59B6" }}>{totalSessions}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>SESSIONS</div>
                  </div>
                </div>

                {/* This week vs last week */}
                <div className="card" style={{ padding: 14, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>This week</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{thisWeekSessions} sessions</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: sessionDiff > 0 ? "#27AE60" : sessionDiff < 0 ? "#E74C3C" : "rgba(255,255,255,0.3)" }}>
                    {sessionDiff > 0 ? `↑ ${sessionDiff} more` : sessionDiff < 0 ? `↓ ${Math.abs(sessionDiff)} fewer` : "Same as last week"}
                  </div>
                </div>

                {/* Weekly bar chart */}
                <div className="card" style={{ padding: 16, marginBottom: 14 }}>
                  <div className="slabel">PAGES PER WEEK</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120, marginTop: 8 }}>
                    {weeks.map((w, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: i === 3 ? "#FF6B35" : "rgba(255,255,255,0.5)" }}>{w.pages}</div>
                        <div style={{ width: "100%", borderRadius: 6, background: i === 3 ? "linear-gradient(180deg,#FF6B35,#FF8E53)" : "rgba(255,255,255,0.1)", height: `${Math.max(4, (w.pages / maxPages) * 90)}%`, transition: "height 0.5s" }} />
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{w.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Badges */}
                <div className="card" style={{ padding: 16 }}>
                  <div className="slabel">BADGES</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                    {BADGES.map(badge => {
                      const myAch = achievements.filter(a => a.childId === activeChildId);
                      const earned = myAch.some(a => a.badgeId === badge.id);
                      return (
                        <div key={badge.id} style={{ textAlign: "center", opacity: earned ? 1 : 0.25, transition: "opacity 0.3s" }}>
                          <div style={{ fontSize: 28, marginBottom: 4, filter: earned ? "none" : "grayscale(1)" }}>{badge.icon}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: earned ? "#F4D03F" : "rgba(255,255,255,0.3)", lineHeight: 1.2 }}>{badge.label}</div>
                          {earned && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Earned!</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>;
            })()}
          </>
        )}

        {/* ════ PARENT MODE ════ */}
        {mode==="parent" && (
          <>
            {/* DASHBOARD */}
            {parentView==="dashboard" && (
              <div className="pop">
                <div className="dashboard-title">👨‍👩‍👧 Parent Dashboard</div>

                {/* Push notification prompt */}
                {showPushPrompt && pushPermission==="default" && (
                  <div className="card fade" style={{padding:16,marginBottom:14,background:"linear-gradient(135deg,rgba(255,107,53,0.12),rgba(255,142,83,0.08))",border:"1px solid rgba(255,107,53,0.3)"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                      <div style={{fontSize:28,flexShrink:0}}>🔔</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>Enable notifications?</div>
                        <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.5,marginBottom:12}}>Get notified when your kids log reading sessions so you can review them quickly.</div>
                        <div style={{display:"flex",gap:8}}>
                          <button className="btn" onClick={handleEnablePush} style={{flex:2,padding:"10px 0",fontSize:13,background:"linear-gradient(135deg,#FF6B35,#FF8E53)",color:"#fff"}}>Enable</button>
                          <button className="btn" onClick={handleDismissPush} style={{flex:1,padding:"10px 0",fontSize:12,background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.4)"}}>Later</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ONBOARDING: no children yet ── */}
                {myChildren.length===0 && (
                  <div style={{marginBottom:20}}>
                    {/* Welcome banner */}
                    <div className="card" style={{padding:22,marginBottom:16,background:"linear-gradient(135deg,rgba(71,118,230,0.2),rgba(142,84,233,0.2))",border:"1px solid rgba(71,118,230,0.35)",textAlign:"center"}}>
                      <div style={{fontSize:44,marginBottom:8}}>👋</div>
                      <div style={{fontSize:18,fontWeight:900,marginBottom:6}}>Welcome to ReadReward!</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.6}}>Let's get your family set up in 2 easy steps so your children can start earning rewards for reading.</div>
                    </div>

                    {/* Step 1 */}
                    <div className="card" style={{padding:18,marginBottom:12,border:"2px solid rgba(71,118,230,0.5)",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:"linear-gradient(180deg,#4776E6,#8E54E9)"}}/>
                      <div style={{paddingLeft:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#4776E6,#8E54E9)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,flexShrink:0}}>1</div>
                          <div style={{fontWeight:900,fontSize:16}}>Add your first child</div>
                        </div>
                        <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",marginBottom:14,lineHeight:1.5}}>Create a profile for each child — give them a name, a colour, a photo, and a 4-digit PIN they'll use to log in.</div>
                        <button className="btn" onClick={()=>setParentView("addChild")} style={{width:"100%",padding:"13px 0",fontSize:14,background:"linear-gradient(135deg,#4776E6,#8E54E9)",color:"#fff",boxShadow:"0 4px 16px rgba(71,118,230,0.4)"}}>
                          👧 Add First Child →
                        </button>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="card" style={{padding:18,marginBottom:12,border:"1px solid rgba(255,255,255,0.1)",position:"relative",overflow:"hidden",opacity:0.5}}>
                      <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:"rgba(255,255,255,0.15)"}}/>
                      <div style={{paddingLeft:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,flexShrink:0}}>2</div>
                          <div style={{fontWeight:900,fontSize:16}}>Your child adds their first book</div>
                        </div>
                        <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.5}}>Once logged in, your child taps <strong>"＋ Add a Book"</strong>, types the title, author, and total pages. They can even snap a photo of the cover!</div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="card" style={{padding:18,border:"1px solid rgba(255,255,255,0.1)",position:"relative",overflow:"hidden",opacity:0.5}}>
                      <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:"rgba(255,255,255,0.15)"}}/>
                      <div style={{paddingLeft:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,flexShrink:0}}>3</div>
                          <div style={{fontWeight:900,fontSize:16}}>Review & approve their logs</div>
                        </div>
                        <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.5}}>After they read, they log their pages here. You'll get a notification to review and approve — or adjust — the reward they've requested.</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── NORMAL STATE: has children ── */}
                {myChildren.length>0 && (()=>{
                  const now = new Date();
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const ONE_DAY = 86400000;
                  const weekAgo = new Date(today.getTime() - 7*ONE_DAY);

                  // Family-wide stats
                  const familyApprovedLogs = logs.filter(l=>l.status==="approved"&&myChildren.some(c=>c.id===l.childId));
                  const familyPagesThisWeek = familyApprovedLogs.reduce((sum,l)=>{
                    const d = l.date==="Just now"?now:new Date(l.date);
                    return d>=weekAgo ? sum+l.pages : sum;
                  },0);
                  const familyBooksCompleted = books.filter(b=>myChildren.some(c=>c.id===b.childId)&&b.done).length;
                  const totalPending = pendingLogs.length + pendingRedemptions.length;

                  return <>
                    {/* Family overview */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                      <div className="card" style={{padding:12,textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:900,color:"#4776E6"}}>{familyPagesThisWeek}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700}}>PAGES THIS WEEK</div>
                      </div>
                      <div className="card" style={{padding:12,textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:900,color:"#27AE60"}}>{familyBooksCompleted}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700}}>BOOKS DONE</div>
                      </div>
                      <div className="card" style={{padding:12,textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:900,color:totalPending>0?"#FF6B35":"rgba(255,255,255,0.3)"}}>{totalPending}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700}}>TO REVIEW</div>
                      </div>
                    </div>

                    {/* Per-child summary cards */}
                    <div className="slabel">YOUR CHILDREN</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                      {myChildren.map(child=>{
                        const cLogs = logs.filter(l=>l.childId===child.id);
                        const cApproved = cLogs.filter(l=>l.status==="approved");
                        const cp = cLogs.filter(l=>l.status==="pending").length;
                        const cRedPending = redemptions.filter(r=>r.childId===child.id&&r.status==="pending").length;
                        const cPagesWeek = cApproved.reduce((sum,l)=>{
                          const d = l.date==="Just now"?now:new Date(l.date);
                          return d>=weekAgo ? sum+l.pages : sum;
                        },0);
                        const cBooksActive = books.filter(b=>b.childId===child.id&&!b.done).length;
                        // Streak
                        const pagesByDay = {};
                        cLogs.forEach(l=>{
                          const d = l.date==="Just now"?today:new Date(l.date);
                          const key = new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
                          pagesByDay[key]=(pagesByDay[key]||0)+l.pages;
                        });
                        const readingDays = Object.entries(pagesByDay).filter(([_,p])=>p>=20).map(([ts])=>Number(ts)).sort((a,b)=>b-a);
                        let cStreak = 0, ck = today.getTime();
                        if(!readingDays.includes(ck)) ck -= ONE_DAY;
                        while(readingDays.includes(ck)){cStreak++;ck-=ONE_DAY;}
                        const totalPendingChild = cp + cRedPending;

                        return <div key={child.id} onClick={()=>{setDetailChildId(child.id);setParentView("childDetail");}} className="card" style={{padding:14,cursor:"pointer",border:`1px solid ${AVATAR_COLORS[child.colorIdx||0][0]}33`}}>
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                            <Avatar child={child} size={44} ring/>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:900,fontSize:16}}>{child.name}</div>
                              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>{cBooksActive} active {cBooksActive===1?"book":"books"}</div>
                            </div>
                            {totalPendingChild>0&&<div style={{background:"#FF6B35",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:800}}>⏳ {totalPendingChild}</div>}
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                              <div style={{fontSize:16,fontWeight:900,color:"#4776E6"}}>{cPagesWeek}</div>
                              <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",fontWeight:700}}>PAGES/WEEK</div>
                            </div>
                            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                              <div style={{fontSize:16,fontWeight:900,color:cStreak>0?"#FF6B35":"rgba(255,255,255,0.3)"}}>{cStreak>0?`🔥${cStreak}`:"—"}</div>
                              <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",fontWeight:700}}>STREAK</div>
                            </div>
                            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                              <div style={{fontSize:16,fontWeight:900,color:"#9B59B6"}}>{cApproved.length}</div>
                              <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",fontWeight:700}}>SESSIONS</div>
                            </div>
                          </div>
                        </div>;
                      })}
                      <div onClick={()=>setParentView("addChild")} className="card" style={{padding:"14px 12px",cursor:"pointer",textAlign:"center",border:"2px dashed rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                        <div style={{fontSize:20,color:"rgba(255,255,255,0.3)"}}>＋</div>
                        <div style={{fontSize:13,color:"rgba(255,255,255,0.3)",fontWeight:700}}>Add child</div>
                      </div>
                    </div>

                    {/* Pending reviews */}
                    <div className="slabel">PENDING REVIEWS {totalPending>0&&`(${totalPending})`}</div>
                    {totalPending===0&&<div className="card" style={{padding:28,textAlign:"center",color:"rgba(255,255,255,0.35)"}}><div style={{fontSize:44,marginBottom:10}}>✨</div><div style={{fontWeight:700}}>All caught up!</div></div>}
                  </>;
                })()}

                {/* pending logs for populated accounts */}
                {myChildren.length>0 && pendingLogs.map(log=>{
                  const child=children.find(c=>c.id===log.childId);
                  const book=books.find(b=>b.childId===log.childId&&b.title===log.bookTitle);
                  const r=rewards.find(r=>r.id===log.reward) || {id:log.reward,label:"Reward",icon:"🎯",unit:"mins",rate:1,color:"#888"};
                  const adjPages=parentAdjust[log.id]!=null?parentAdjust[log.id]:log.pages;
                  const adjPts=calcPts(adjPages, log.difficulty, log.reward);
                  const changed=adjPages!==log.pages;
                  const [ac]=child?AVATAR_COLORS[child.colorIdx||0]:["#888","#aaa"];
                  const isReread=book&&(book.pagesRead>book.totalPages);
                  return <div key={log.id} className="card" style={{padding:16,marginBottom:14,border:`1px solid ${ac}30`}}>
                    {/* Child identity bar */}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                      {child&&<Avatar child={child} size={38} ring/>}
                      <div style={{flex:1}}><div style={{fontWeight:900,fontSize:15}}>{child?.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>submitted {log.date}</div></div>
                      {isReread&&<div style={{fontSize:11,color:"#F59E0B",fontWeight:700}}>📖 Re-read</div>}
                    </div>
                    {/* Book */}
                    <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:12}}>
                      {book&&<div style={{width:40,flexShrink:0,borderRadius:7,overflow:"hidden"}}><div style={{paddingBottom:"144%",position:"relative"}}><img src={book.cover} alt={book.title} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/></div></div>}
                      <div><div style={{fontWeight:800,fontSize:15}}>{log.bookTitle}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{log.pages} pages · {log.difficulty}</div></div>
                    </div>
                    {/* Reward + adjuster */}
                    <div style={{background:r.color+"14",border:`1px solid ${r.color}30`,borderRadius:12,padding:"10px 14px",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20}}>{r.icon}</span>
                          <div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Requested</div><div style={{fontWeight:900,color:r.color,fontSize:15}}>{calcPts(log.pages, log.difficulty, log.reward)} {r.unit==="p"?"pence":`${r.unit}`}</div></div>
                        </div>
                        {changed&&<div style={{textAlign:"right"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Adjusted to</div><div style={{fontWeight:900,color:"#27AE60",fontSize:15}}>{adjPts} {r.unit==="p"?"pence":`${r.unit}`}</div></div>}
                      </div>
                      <div style={{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:10}}>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:8,fontWeight:700,letterSpacing:1}}>ADJUST PAGES</div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <button onClick={()=>setParentAdjust(a=>({...a,[log.id]:Math.max(1,(a[log.id]??log.pages)-5)}))} style={{border:"none",cursor:"pointer",borderRadius:10,background:"rgba(255,255,255,0.1)",color:"#fff",width:38,height:38,fontSize:18,fontWeight:900,flexShrink:0}}>−</button>
                          <input type="number" value={adjPages} onChange={e=>{const v=parseInt(e.target.value);if(!isNaN(v)&&v>0)setParentAdjust(a=>({...a,[log.id]:v}));}} style={{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"8px 0",color:"#fff",fontSize:18,fontWeight:900,textAlign:"center",outline:"none"}}/>
                          <button onClick={()=>setParentAdjust(a=>({...a,[log.id]:(a[log.id]??log.pages)+5}))} style={{border:"none",cursor:"pointer",borderRadius:10,background:"rgba(255,255,255,0.1)",color:"#fff",width:38,height:38,fontSize:18,fontWeight:900,flexShrink:0}}>＋</button>
                          {changed&&<button onClick={()=>setParentAdjust(a=>{const n={...a};delete n[log.id];return n;})} style={{border:"none",cursor:"pointer",borderRadius:10,background:"rgba(255,107,53,0.2)",color:"#FF6B35",padding:"0 12px",height:38,fontSize:12,fontWeight:800,flexShrink:0}}>Reset</button>}
                        </div>
                        {changed&&<div style={{fontSize:11,color:"#F59E0B",marginTop:8,fontWeight:600}}>⚡ Reward: {adjPts} {r.unit==="p"?"pence":`${r.unit}`} (was {calcPts(log.pages, log.difficulty, log.reward)})</div>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      <button className="btn" onClick={()=>approveLog(log.id,changed?adjPages:null)} disabled={authLoading} style={{flex:2,padding:"13px 0",background:"linear-gradient(135deg,#27AE60,#2ECC71)",color:"#fff",fontSize:14,opacity:authLoading?0.6:1}}>✅ Approve{changed?" (adjusted)":""}</button>
                      <button className="btn" onClick={()=>rejectLog(log.id)} disabled={authLoading} style={{flex:1,padding:"13px 0",background:"rgba(231,76,60,0.18)",border:"1.5px solid #E74C3C40",color:"#E74C3C",fontSize:14,opacity:authLoading?0.6:1}}>❌ Reject</button>
                    </div>
                  </div>;
                })}

                {/* Pending redemptions */}
                {myChildren.length>0 && pendingRedemptions.map(rd=>{
                  const child=children.find(c=>c.id===rd.childId);
                  const r=rewards.find(r=>r.id===rd.rewardTypeId) || {id:"?",label:"Reward",icon:"🎯",unit:"mins",rate:1,color:"#888"};
                  const [ac]=child?AVATAR_COLORS[child.colorIdx||0]:["#888","#aaa"];
                  return <div key={rd.id} className="card" style={{padding:16,marginBottom:14,border:`1px solid ${ac}30`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                      {child&&<Avatar child={child} size={38} ring/>}
                      <div style={{flex:1}}><div style={{fontWeight:900,fontSize:15}}>{child?.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:1}}>wants to redeem · {rd.date}</div></div>
                      <Badge color="#9B59B6">redemption</Badge>
                    </div>
                    <div style={{background:r?.color+"14",border:`1px solid ${r?.color||"#888"}30`,borderRadius:12,padding:"14px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:28}}>{r?.icon}</span>
                      <div>
                        <div style={{fontWeight:900,fontSize:18,color:r?.color}}>{rd.amount} {r?.unit}</div>
                        <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{rd.tierLabel} · {r?.label}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      <button className="btn" onClick={()=>approveRedemption(rd.id)} disabled={authLoading} style={{flex:2,padding:"13px 0",background:"linear-gradient(135deg,#27AE60,#2ECC71)",color:"#fff",fontSize:14,opacity:authLoading?0.6:1}}>✅ Approve</button>
                      <button className="btn" onClick={()=>rejectRedemption(rd.id)} disabled={authLoading} style={{flex:1,padding:"13px 0",background:"rgba(231,76,60,0.18)",border:"1.5px solid #E74C3C40",color:"#E74C3C",fontSize:14,opacity:authLoading?0.6:1}}>❌ Reject</button>
                    </div>
                  </div>;
                })}
              </div>
            )}

            {/* ADD CHILD */}
            {parentView==="addChild" && (
              <div className="pop">
                <button className="btn" onClick={()=>setParentView("dashboard")} style={{background:"rgba(255,255,255,0.1)",color:"#fff",padding:"7px 14px",marginBottom:16,fontSize:14}}>← Back</button>
                <div style={{fontSize:20,fontWeight:900,marginBottom:20}}>👧 Add a Child</div>
                <div className="card" style={{padding:16,marginBottom:12}}>
                  <div className="slabel">CHOOSE AN AVATAR</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                    {AVATAR_CHARACTERS.map(av=>(
                      <button key={av.id} onClick={()=>setAddChildForm(f=>({...f,avatar:av.id}))} style={{border:addChildForm.avatar===av.id?"3px solid #4776E6":"3px solid transparent",borderRadius:14,padding:6,background:addChildForm.avatar===av.id?"rgba(71,118,230,0.15)":"rgba(255,255,255,0.05)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <img src={av.src} alt={av.label} style={{width:56,height:75,objectFit:"contain"}}/>
                        <div style={{fontSize:9,color:addChildForm.avatar===av.id?"#4776E6":"rgba(255,255,255,0.4)",fontWeight:700}}>{av.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:14}}>
                  <div><div className="slabel">CHILD'S NAME *</div><input className="ifield" placeholder="e.g. Sophie" value={addChildForm.name} onChange={e=>setAddChildForm(f=>({...f,name:e.target.value,error:""}))} /></div>
                  <div><div className="slabel">USERNAME *</div><input className="ifield" placeholder="e.g. sophie" value={addChildForm.username} onChange={e=>setAddChildForm(f=>({...f,username:e.target.value.toLowerCase().replace(/\s/g,""),error:""}))} /></div>
                </div>
                <div className="card" style={{padding:16,marginBottom:12}}>
                  <div className="slabel">4-DIGIT PIN *</div>
                  <PinPad length={4} value={addChildForm.pin} onChange={v=>setAddChildForm(f=>({...f,pin:v,error:""}))} />
                </div>
                <div className="card" style={{padding:16,marginBottom:20}}>
                  <div className="slabel">CONFIRM PIN *</div>
                  <PinPad length={4} value={addChildForm.pinConfirm} onChange={v=>setAddChildForm(f=>({...f,pinConfirm:v,error:""}))} error={addChildForm.error}/>
                </div>
                <button className="btn" onClick={submitAddChild} disabled={authLoading} style={{width:"100%",padding:"15px 0",fontSize:16,background:addChildForm.name&&addChildForm.username&&addChildForm.pin?"linear-gradient(135deg,#4776E6,#8E54E9)":"rgba(255,255,255,0.07)",color:"#fff",opacity:authLoading?0.6:1}}>
                  {authLoading?"Saving…":`＋ Add ${addChildForm.name||"Child"}`}
                </button>
              </div>
            )}

            {/* CHILD DETAIL */}
            {parentView==="childDetail" && detailChildId && (()=>{
              const child=children.find(c=>c.id===detailChildId);
              if(!child) return null;
              const cBooks=books.filter(b=>b.childId===detailChildId);
              const cLogs=logs.filter(l=>l.childId===detailChildId);
              const cEarned=cLogs.filter(l=>l.status==="approved").reduce((acc,l)=>{
                const r=rewards.find(r=>r.id===l.reward) || {id:"?",label:"Reward",icon:"🎯",unit:"mins",rate:1,color:"#888"};
                acc[l.reward]=(acc[l.reward]||0)+calcPts(l.pages, l.difficulty, l.reward);
                return acc;
              },{});
              const cRedemptions=redemptions.filter(r=>r.childId===detailChildId);
              const cRedeemed=cRedemptions.filter(r=>r.status==="approved").reduce((acc,r)=>{
                acc[r.rewardTypeId]=(acc[r.rewardTypeId]||0)+r.amount; return acc;
              },{});
              const cBalance=rewards.reduce((acc,r)=>{acc[r.id]=Math.max(0,(cEarned[r.id]||0)-(cRedeemed[r.id]||0));return acc;},{});
              const isEditingPin = editChildPin.id===child.id;
              return <div className="pop">
                <button className="btn" onClick={()=>setParentView("dashboard")} style={{background:"rgba(255,255,255,0.1)",color:"#fff",padding:"7px 14px",marginBottom:16,fontSize:14}}>← Back</button>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
                  <Avatar child={child} size={56} ring/>
                  <div><div style={{fontSize:22,fontWeight:900}}>{child.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{cBooks.filter(b=>b.done).length} completed · {cLogs.filter(l=>l.status==="approved").length} sessions</div></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>{rewards.map(r=><RewardPill key={r.id} reward={r} earned={cBalance[r.id]||0}/>)}</div>

                {/* PIN section */}
                <div className="card" style={{padding:16,marginBottom:16,border:"1px solid rgba(255,255,255,0.15)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:isEditingPin?14:0}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:15}}>🔒 Child PIN</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>Securely hashed — set a new one below</div>
                    </div>
                    <button className="btn" onClick={()=>setEditChildPin({id:child.id,pin:"",confirm:"",error:""})} style={{background:"rgba(71,118,230,0.2)",color:"#93C5FD",padding:"7px 12px",fontSize:12}}>✏️ Change</button>
                  </div>
                  {isEditingPin&&<div>
                    <div style={{marginBottom:12}}><div className="slabel" style={{marginTop:12}}>NEW PIN</div><PinPad length={4} value={editChildPin.pin} onChange={v=>setEditChildPin(f=>({...f,pin:v,error:""}))} /></div>
                    <div style={{marginBottom:14}}><div className="slabel">CONFIRM PIN</div><PinPad length={4} value={editChildPin.confirm} onChange={v=>setEditChildPin(f=>({...f,confirm:v,error:""}))} error={editChildPin.error}/></div>
                    <div style={{display:"flex",gap:10}}>
                      <button className="btn" onClick={saveChildPin} disabled={authLoading} style={{flex:2,padding:"11px 0",background:"linear-gradient(135deg,#27AE60,#2ECC71)",color:"#fff",fontSize:14,opacity:authLoading?0.6:1}}>{authLoading?"Saving…":"Save PIN"}</button>
                      <button className="btn" onClick={()=>setEditChildPin({id:null,pin:"",confirm:"",error:""})} style={{flex:1,padding:"11px 0",background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)",fontSize:14}}>Cancel</button>
                    </div>
                  </div>}
                </div>

                {/* Badges */}
                {(()=>{
                  const childAch = achievements.filter(a=>a.childId===detailChildId);
                  const earnedCount = childAch.length;
                  return earnedCount > 0 ? (
                    <div style={{marginBottom:14}}>
                      <div className="slabel">BADGES ({earnedCount}/{BADGES.length})</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {BADGES.filter(b=>childAch.some(a=>a.badgeId===b.id)).map(badge=>(
                          <div key={badge.id} style={{background:"rgba(244,208,63,0.1)",border:"1px solid rgba(244,208,63,0.25)",borderRadius:10,padding:"6px 10px",display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:16}}>{badge.icon}</span>
                            <span style={{fontSize:11,fontWeight:700,color:"#F4D03F"}}>{badge.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Books */}
                <div className="slabel">BOOKS</div>
                {cBooks.map(b=><div key={b.id} className="card" style={{padding:"12px 14px",marginBottom:8,display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:36,flexShrink:0,borderRadius:6,overflow:"hidden"}}><div style={{paddingBottom:"144%",position:"relative"}}><img src={b.cover} alt={b.title} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/></div></div>
                  <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14}}>{b.title}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{b.pagesRead}/{b.totalPages} pp · {b.difficulty}</div><div style={{marginTop:6,background:"rgba(255,255,255,0.08)",borderRadius:20,height:4}}><div style={{height:"100%",borderRadius:20,width:`${Math.min(100,(b.pagesRead/b.totalPages)*100)}%`,background:"linear-gradient(90deg,#FF6B35,#FF8E53)"}}/></div></div>
                  {b.done&&<div style={{fontSize:20}}>✅</div>}
                </div>)}
              </div>;
            })()}

            {/* SETUP TAB */}
            {parentView==="setup" && (
              <SetupTab
                parentAccount={parentAccount}
                myChildren={myChildren}
                rewards={rewards} setRewards={setRewards}
                diffBonuses={diffBonuses} setDiffBonuses={setDiffBonuses}
                calcPts={calcPts}
                onLogout={handleLogout}
                onSaveReward={async (reward) => {
                  await upsertRewardConfig({
                    reward_key: reward.id, label: reward.label, icon: reward.icon,
                    unit: reward.unit, rate: reward.rate, color: reward.color,
                    sort_order: rewards.findIndex(r=>r.id===reward.id),
                    tiers: reward.tiers || [],
                    auto_approve: reward.autoApprove || false,
                  });
                }}
                onDeleteReward={async (rewardId) => {
                  await deleteRewardConfig(rewardId);
                }}
                onSaveBonus={async (diff, bonus) => {
                  await upsertDifficultyBonus({
                    difficulty: diff, bonusType: bonus.bonusType, bonusValue: bonus.bonusValue,
                  });
                }}
                onChangePin={async (childId, pin) => {
                  const { hash, error: hashErr } = await hashPin(pin);
                  if(hashErr || !hash) return "Failed to secure PIN";
                  const { error: dbErr } = await updateChildInDb(childId, { pin_hash: hash });
                  if(dbErr) return dbErr.message;
                  return null; // success
                }}
              />
            )}
          </>
        )}
      </div>

      {/* NEW BADGE POPUP */}
      {newBadge && (
        <div className="badge-popup-overlay" onClick={()=>setNewBadge(null)}>
          <div className="badge-popup pop">
            <div className="badge-popup-icon float">{newBadge.icon}</div>
            <div className="badge-popup-tag">NEW BADGE EARNED!</div>
            <div className="badge-popup-name">{newBadge.label}</div>
            <div className="badge-popup-desc">{newBadge.desc}</div>
            <button className="btn badge-popup-btn" onClick={()=>setNewBadge(null)}>Awesome!</button>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div className="bottom-nav">
        {mode==="child" && (childView==="home"||childView==="stats") && (
          <>
            <button className={`btn nav-btn ${childView==="home"?"nav-btn-active-orange":"nav-btn-inactive"}`} onClick={()=>setChildView("home")}>🏠 Home</button>
            <button className={`btn nav-btn ${childView==="stats"?"nav-btn-active":"nav-btn-inactive"}`} onClick={()=>setChildView("stats")}>📊 Stats</button>
            <button className={`btn nav-btn ${canAddBook?"nav-btn-inactive":"nav-btn-disabled"}`} onClick={()=>canAddBook&&setChildView("addBook")} style={{cursor:canAddBook?"pointer":"not-allowed"}}>
              {canAddBook?"＋ Book":"🔒 Full"}
            </button>
          </>
        )}
        {mode==="parent" && (
          <>
            <button className={`btn nav-btn ${parentView==="dashboard"?"nav-btn-active":"nav-btn-inactive"}`} onClick={()=>setParentView("dashboard")}>🏠 Home</button>
            <button className={`btn nav-btn ${parentView==="setup"?"nav-btn-active":"nav-btn-inactive"}`} onClick={()=>setParentView("setup")}>⚙️ Setup</button>
            <button className="btn nav-btn nav-btn-inactive" onClick={()=>{setChildPickMode(true);setActiveChildId(null);setMode("child");}}>👧 Kids</button>
          </>
        )}
      </div>
    </Wrap>
  );
}