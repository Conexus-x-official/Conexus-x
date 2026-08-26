/**
 * Workspace cover art, hosted in Cloudinary.
 *
 * A CATALOG rather than a single import, because the next step is letting a
 * workspace pick its own: adding one is a row here plus the upload, and the
 * picker, the banner and any default all read from this same list — so none of
 * the three can end up offering something the others do not have.
 *
 * The files live under `<CLOUDINARY_FOLDER>/banners/` in the project's own
 * Cloudinary account, not in the repo. Cover art is content, not code: shipping
 * it through the bundle means a redeploy to change a picture, and the 636KB
 * JPEG below would have been 636KB every visitor paid for in the JS payload.
 * Cloudinary also does the format negotiation and resizing that next/image
 * would otherwise be doing against a local file.
 */

const CLOUD = "https://res.cloudinary.com/mihx2v7q/image/upload";
const FOLDER = "Conexus-x/banners";

export interface Banner {
    key: string;
    label: string;
    url: string;
}

export const BANNERS: Banner[] = [
    {
        key: "banner1",
        label: "Ridge",
        url: `${CLOUD}/${FOLDER}/banner1.jpg`,
    },
    {
        key: "workspace-cover",
        label: "Default",
        // The original placeholder, kept so nothing that already looked right
        // is taken away by this change.
        url: `${CLOUD}/${FOLDER}/workspace-cover.svg`,
    },
];

export const DEFAULT_BANNER = BANNERS[0];

/** Unknown keys fall back rather than rendering an empty cover. */
export const bannerByKey = (key?: string) =>
    BANNERS.find((banner) => banner.key === key) ?? DEFAULT_BANNER;

/**
 * Turns a stored value into a URL, or null when there is no art to draw.
 *
 * Workspace.banner holds EITHER a catalog key or an absolute URL — see the
 * model. Keys are the normal case and survive the catalog being restyled;
 * a URL is the escape hatch for art the catalog does not contain, which is
 * what per-workspace covers eventually need.
 *
 * NULL, NOT A DEFAULT PICTURE. This used to hand back the placeholder cover
 * for an empty value, which meant every workspace nobody had chosen art for
 * wore the same stock image — and a stock image reads as a workspace's own
 * picture, not as the absence of one. The caller draws a plain themed surface
 * instead. An unrecognised key resolves the same way rather than to unrelated
 * art: a key that has been retired from the catalog is also "no cover".
 */
export const resolveBannerUrl = (value?: string): string | null => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return BANNERS.some((banner) => banner.key === value)
        ? bannerByKey(value).url
        : null;
};

/** The catalog key currently in use, or "" when it is a bare URL. */
export const bannerKeyOf = (value?: string): string => {
    if (!value || /^https?:\/\//i.test(value)) return "";
    return BANNERS.some((banner) => banner.key === value) ? value : "";
};
