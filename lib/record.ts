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
  nationalId: null,
  passportIssueDate: null,
  passportExpiryDate: null,
  previousPassports: [],
  photo: null,
};
