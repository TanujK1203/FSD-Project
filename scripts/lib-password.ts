import bcrypt from "bcryptjs";
export const hashPassword = (p: string) => bcrypt.hash(p, 11);
