import type { ImportProfile } from "./actions";

export const EMPTY_PROFILE: ImportProfile = {
  fullName: null,
  dateOfBirth: null,
  sex: null,
  nationality: null,
  address: null,
  phone: null,
  email: null,
  passportNumber: null,
  previousPassports: [],
  photo: null,
};
