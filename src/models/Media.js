"use strict";

const { mongoose } = require("../config/db");
const { resolveAssetUrl } = require("../utils/assets");

/* ------------------------------------------------------------------ */
/* MediaFolder — logical folders (DB-only). Files stay flat on disk    */
/* under immutable keys; a "move" is a field update, so URLs never     */
/* break. Flat folder list (no nesting) for the MVP.                   */
/* ------------------------------------------------------------------ */

const mediaFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

mediaFolderSchema.methods.toAdminJSON = function toAdminJSON() {
  return { id: this._id, name: this.name, createdAt: this.createdAt };
};

const MediaFolder = mongoose.model("MediaFolder", mediaFolderSchema);

/* ------------------------------------------------------------------ */
/* MediaAsset — the catalog record for an uploaded file.               */
/* `key` is the immutable relative storage key (/uploads/<name>);      */
/* `displayName` is what admins see and can rename freely.             */
/* ------------------------------------------------------------------ */

const mediaAssetSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true, trim: true },
    originalName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 }, // bytes
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    alt: { type: String, default: "" },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MediaFolder",
      default: null, // null = root
      index: true,
    },
    uploadedByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

mediaAssetSchema.index({ createdAt: -1 });
mediaAssetSchema.index({ displayName: 1 });

mediaAssetSchema.methods.toAdminJSON = function toAdminJSON() {
  const obj = {
    id: this._id,
    key: this.key,
    url: resolveAssetUrl(this.key),
    displayName: this.displayName,
    originalName: this.originalName,
    mimeType: this.mimeType,
    size: this.size,
    width: this.width,
    height: this.height,
    alt: this.alt,
    folder: null,
    uploadedByEmail: this.uploadedByEmail,
    createdAt: this.createdAt,
  };
  if (this.folder && this.folder.name) {
    obj.folder = { id: this.folder._id, name: this.folder.name };
  } else if (this.folder) {
    obj.folder = { id: this.folder };
  }
  return obj;
};

const MediaAsset = mongoose.model("MediaAsset", mediaAssetSchema);

module.exports = { MediaAsset, MediaFolder };
