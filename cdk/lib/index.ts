import { join } from "path";

import {
  Aws,
  Stack,
  StackProps,
  aws_iam,
  aws_elasticache,
  aws_ec2,
  aws_s3,
  aws_cloudfront,
  aws_cloudfront_origins,
  CfnOutput,
  CfnParameter,
} from "aws-cdk-lib";
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { RustFunction } from "cargo-lambda-cdk";
import { Construct } from "constructs";
import { BlockPublicAccess, BucketAccessControl } from "aws-cdk-lib/aws-s3";

export class UrlShortenerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const defaultVpc = aws_ec2.Vpc.fromLookup(this, "DefaultVpc", {
      isDefault: true,
    });
    const selectedSubnets = defaultVpc.selectSubnets({
      subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
    });
    const urlShortenerSubnetGroup = new aws_elasticache.CfnSubnetGroup(
      this,
      "UrlShortenerSubnetGroup",
      {
        description: "Isolated subnet group for URL Shortener",
        subnetIds: selectedSubnets.subnetIds,
        cacheSubnetGroupName: "UrlShortenerSubnetGroup",
      },
    );
    const urlShortenerSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      "UrlShortenerSecurityGroup",
      {
        vpc: defaultVpc,
        allowAllOutbound: true,
      },
    );
    urlShortenerSecurityGroup.addIngressRule(
      urlShortenerSecurityGroup,
      aws_ec2.Port.tcp(6379),
      "Allow Redis access within the security group",
    );

    const cacheCluster = new aws_elasticache.CfnCacheCluster(
      this,
      "UrlShortenerCache",
      {
        cacheNodeType: "cache.t3.micro",
        numCacheNodes: 1,
        engine: "redis",
        cacheSubnetGroupName: urlShortenerSubnetGroup.cacheSubnetGroupName,
        vpcSecurityGroupIds: [urlShortenerSecurityGroup.securityGroupId],
      },
    );
    cacheCluster.addDependency(urlShortenerSubnetGroup);
    cacheCluster.node.addDependency(urlShortenerSecurityGroup);

    const clusterArn = `arn:aws:elasticache:${Aws.REGION}:${Aws.ACCOUNT_ID}:cluster:${cacheCluster.ref}`;
    const lambdaRole = new aws_iam.Role(this, "lambda-access", {
      assumedBy: new aws_iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    const elasticachePolicy = new aws_iam.PolicyStatement({
      effect: aws_iam.Effect.ALLOW,
      actions: ["elasticache:Connect"],
      resources: [clusterArn],
    });
    lambdaRole.addToPolicy(elasticachePolicy);

    const redisEndpointAddress = cacheCluster.attrRedisEndpointAddress;
    const redisEndpoint = `redis://${redisEndpointAddress}:6379`;
    const cloudFrontUrl = new CfnParameter(this, "CloudFrontUrlParameter", {
      type: "String",
      description: "CloudFront URL.",
      default: "placeholder_cloud_front_url",
    });
    const handler = new RustFunction(this, "URLShortener", {
      environment: {
        ELASTICACHE_CLUSTER_ENDPOINT: redisEndpoint,
        ENDPOINT: cloudFrontUrl.valueAsString,
      },
      vpc: defaultVpc,
      vpcSubnets: {
        subnets: selectedSubnets.subnets,
      },
      securityGroups: [urlShortenerSecurityGroup],
      manifestPath: join(__dirname, "..", ".."),
    });
    handler.node.addDependency(urlShortenerSubnetGroup);
    handler.node.addDependency(urlShortenerSecurityGroup);

    const apiGateway = new LambdaRestApi(this, "UrlShortenerApi", { handler });

    const bucket = new aws_s3.Bucket(this, "URLShortenerBucket", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    });

    const distribution = new aws_cloudfront.Distribution(
      this,
      "URLShortenerCFDistribution",
      {
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
        defaultBehavior: {
          origin: new aws_cloudfront_origins.S3Origin(bucket),
          viewerProtocolPolicy:
            aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Redirect HTTP to HTTPS
          cachePolicy: aws_cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        additionalBehaviors: {
          "/api*": {
            // Route requests with "/api" prefix to the API Gateway endpoint
            origin: new aws_cloudfront_origins.RestApiOrigin(apiGateway),
            allowedMethods: aws_cloudfront.AllowedMethods.ALLOW_ALL,
            viewerProtocolPolicy:
              aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: aws_cloudfront.CachePolicy.CACHING_DISABLED,
          },
        },
      },
    );

    const actualCloudFrontUrl = `https://${distribution.distributionDomainName}`;

    new CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
      description: "Name of the S3 bucket.",
    });
    new CfnOutput(this, "CloudFrontURL", {
      value: actualCloudFrontUrl,
      description: "CloudFront URL.",
    });
  }
}
