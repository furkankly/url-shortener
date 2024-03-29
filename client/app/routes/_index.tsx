import type { MetaFunction } from "@remix-run/node";
import {
  Form,
  ClientActionFunctionArgs,
  Link,
  useActionData,
} from "@remix-run/react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import urlShortener from "../../public/url-shortener.png";
import { CopyToClipboard } from "~/components/ui/copy-to-clipboard";

export const meta: MetaFunction = () => {
  return [
    { title: "URL Shortener" },
    { name: "description", content: "URL Shortener" },
  ];
};

type CreateResponse = {
  key: string;
  long_url: string;
  short_url: string;
};

type JSONResponse = {
  data?: CreateResponse;
  error?: { message: string };
};

export const clientAction = async ({ request }: ClientActionFunctionArgs) => {
  const body = await request.formData();
  try {
    const response = await fetch(import.meta.env.VITE_REMIX_APP_API, {
      method: "POST",
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify({ url: body.get("url") }),
    });
    const result: JSONResponse = await response.json();
    return result;
  } catch (err) {
    return { error: { message: "Network error" } };
  }
};

export default function Index() {
  const actionData = useActionData<typeof clientAction>();
  return (
    <div className="flex h-dvh flex-col items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <img className="inline h-8" src={urlShortener} alt="Logo" />
            URL Shortener
          </CardTitle>
          <CardDescription>
            {actionData?.data
              ? "Your URL is shortened successfully."
              : "Enter a URL below to shorten it."}
          </CardDescription>
        </CardHeader>
        {actionData?.data ? (
          <CardContent>
            <div className="flex flex-col gap-2 break-all">
              <p>
                <span className="font-bold">Long URL:</span>{" "}
                {actionData.data.long_url}
              </p>
              <p>
                <span className="font-bold">Short URL:</span>{" "}
                {actionData.data.short_url}
              </p>
              <CopyToClipboard textToCopy={actionData.data.short_url} />
              <Button asChild>
                <Link to="/" className="inline-block w-full">
                  Shorten another
                </Link>
              </Button>
            </div>
          </CardContent>
        ) : (
          <Form method="POST">
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="e.g https://google.com"
                  required
                />
                {actionData?.error?.message ? (
                  <span className="text-sm text-red-800">
                    {actionData.error.message}
                  </span>
                ) : null}
              </div>
            </CardContent>
            <CardFooter>
              <Button className="inline-block w-full" type="submit">
                Shorten URL
              </Button>
            </CardFooter>
          </Form>
        )}
      </Card>
    </div>
  );
}
