import { useContext } from "react";

import { UiStateContext } from "./UiStateContext";

export const useUiStateContext = () => useContext(UiStateContext);
