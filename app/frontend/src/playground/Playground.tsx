import { Provider } from "react-redux";
import { store } from "./store";
import PlaygroundRoot from "./components/PlaygroundRoot";
import ToastContainer from "./components/ToastContainer";

export default function PlaygroundApp() {
  return (
    <Provider store={store}>
      <PlaygroundRoot />
      <ToastContainer />
    </Provider>
  );
}