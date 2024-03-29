# cdk

To install dependencies:

```bash
bun install
```

To run:

```bash
bun cdk deploy
# we want to use the default AWS url, so deploy it again
bun cdk deploy --parameters CloudFrontUrlParameter=https://actual.cloudfront.net
bun buildAndUploadSPA.ts actual-bucket-name https://actual.cloudfront.net
```

This project was created using `bun init` in bun v1.0.26. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
