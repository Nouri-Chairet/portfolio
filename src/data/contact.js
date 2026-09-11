/**
 * Where to reach me. Read by the contact section and the navbar's résumé link,
 * so an address changes in one place.
 *
 * Matches the CV's header line. The LinkedIn and GitHub URLs are the ones the
 * CV lists; the résumé path is the file served from public/.
 */

/** From the CV. The mailto link and the visible text both read it. */
export const EMAIL = 'nouric576@gmail.com';

/** From the CV's header line. */
export const LOCATION = 'Sousse, Tunisia';

export const LINKEDIN_URL = 'https://www.linkedin.com/in/nouri-ch-554021266/';
export const GITHUB_URL = 'https://github.com/Nouri-Chairet';

/**
 * The CV itself: the same document every word on the site is taken from.
 * Served from public/, never imported — it is not part of any bundle.
 *
 * RESUME_FILENAME is only what the visitor's browser saves it as (the
 * `download` attribute); the URL is whatever the file in public/ is called.
 */
export const RESUME_HREF = '/cv_nour_eddine_chairet_en-2.pdf';
export const RESUME_FILENAME = 'Nour_Eddine_Chairet_CV.pdf';
