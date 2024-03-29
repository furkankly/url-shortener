import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { UrlShortenerStack } from "../lib";

const app = new cdk.App();
new UrlShortenerStack(app, "url-shortener-stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
