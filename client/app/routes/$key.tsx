import { ClientLoaderFunctionArgs, redirectDocument } from "@remix-run/react";

export const clientLoader = ({ params }: ClientLoaderFunctionArgs) => {
  return redirectDocument(
    `${import.meta.env.VITE_REMIX_APP_API}/${params.key}`
  );
};

export default function Redirect() {
  return <></>;
}
