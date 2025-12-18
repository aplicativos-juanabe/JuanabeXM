import { createContext } from "react";

export const NotificationContext = createContext({
  push: () => {},
  remove: () => {},
});