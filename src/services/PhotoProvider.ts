import type { Property } from '../types';

/** Replace this adapter when a licensed MLS media feed or Street View provider is configured. */
export interface PhotoProvider { getListingPhotos(property: Property): Promise<string[]>; }
export const noOpPhotoProvider: PhotoProvider = { async getListingPhotos() { return []; } };
