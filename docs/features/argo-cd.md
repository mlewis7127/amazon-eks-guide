---
sidebar_position: 2
---

# EKS Capabilities - Argo CD

## Overview

:::info
Argo CD is a declarative, GitOps continuous delivery tool for Kubernetes
:::

Argo CD is a GitOps based continuous deployment tool. Your git repository becomes the source of truth, and Argo CD ensures that your cluster state matches what you have defined in git. AWS have been consistently guiding their customers towards GitOps for a number of years. AWS describe GitOps as being like a reference implementation of best practice with these 4 characteristics:

* Desired state expressed declaratively
* Desired state is immutable and versioned
* Desired state is automatically applied from source
* Desired state is continuously reconciled

Argo CD is used by most of AWS customers practicing GitOps in 2025, and has really emerged as its own de facto standard.

This section runs through how to get started with Argo CD as an EKS Capability.

## Create an IAM Capability Role

EKS Capabilities use a Capability IAM Role to act on your behalf, running controllers in EKS. EKS Capabilities introduced a new service principle called `capabilities.eks.amazonaws.com`. When you create the capability role, you need to ensure the trust policy trusts this new service principle. An example of the required trust policy is shown below:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "capabilities.eks.amazonaws.com"
            },
            "Action": [
                "sts:AssumeRole",
                "sts:TagSession"
            ]
        }
    ]
}
```
You attach permissions to the Capability IAM role based on capability needs, depending on how you want to use the capabilities and what integrations you need. For example, for Argo CD you may need to give permissions to `ecr` or `codecommit` or `codeconnection`, depending on where your source is coming from.

When choosing "Create Argo CD role" through the console, an IAM role with the `AWSSecretsManagerClientReadOnlyAccess` managed policy pre-selected is created. This managed policy provides read access to all secrets stored in Secrets Manager in your AWS account and is intended for getting started quickly. You have the flexibility to modify these permissions by unselecting this policy or adding different policies as needed. 

We can replicate the above functionality running the following command to create the required role:

```bash
aws iam create-role \
  --role-name ArgoCDCapabilityRole \
  --assume-role-policy-document file://argocd-trust-policy.json
  --policy-arn arn:aws:iam::aws:policy/AWSSecretsManagerClientReadOnlyAccess
```





Fully managed and hosted Argo UI for each capability resource.


The Argo CD Capability is integrated with AWS Identity Centre. This is how we enable single sign-on for Argo UI and Argo CLI. For this, you need to ensure that your identity centre is enabled and you pass on the identity centre configuration when you are creating the capability.











```shell
aws eks create-capability
--capability-name capability-name
--cluster-name cluster-name
--type ARGOCD
--role-arn arn:aws:iam:account:role/capability-role
--configuration <aws-identity-centre-configuration.json
```


## Register your EKS cluster with Argo CD

Anytime you want to use a cluster as a valid target for Argo CD, you first need to register it with Argo CD. This is done by creating a Kubernetes secret, and passing the label of `argocd.argoproj.io/secret-type: cluster`. You give the cluster a name, and this is where the mapping between the actual cluster and the ARN happens. With EKS Capabilities you only need to provide the ARN and not the Kubernetes API Server URL as with a self-managed instance.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: local-cluster
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: cluster
stringData:
  name: local-cluster
  server: arn:aws:eks:us-west-2:111122223333:cluster/my-cluster
  project: default
```



Similar to the clusters, you also need to register all of your source repositories




Application resources define what to deploy and where.


The AWS managed policy `AWSSecretsManagerClientReadOnlyAccess` is attached

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SecretsManagerGetAndDescribeSecret",
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": "arn:aws:secretsmanager:*:*:secret:*"
        },
        {
            "Sid": "KMSDecryptKey",
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt"
            ],
            "Resource": "arn:aws:kms:*:*:key/*",
            "Condition": {
                "StringLike": {
                    "kms:EncryptionContext:SecretARN": "arn:aws:secretsmanager:*:*:secret:*",
                    "kms:ViaService": "secretsmanager.*.amazonaws.com"
                }
            }
        }
    ]
}
```


## View Access Entries


```bash
aws eks list-access-entries \
  --cluster-name eks-test-cluster
```

```json
{
    "accessEntries": [
        "arn:aws:iam::424727766526:role/AmazonEKSCapabilityArgoCDRole",
        "arn:aws:iam::424727766526:role/aws-reserved/sso.amazonaws.com/eu-west-2/AWSReservedSSO_Developer_b664db2de4791f77",
        "arn:aws:iam::424727766526:role/aws-service-role/eks.amazonaws.com/AWSServiceRoleForAmazonEKS",
        "arn:aws:iam::424727766526:role/eks-test-cluster-eks-auto-20260104201518766700000002"
    ]
}
```

```bash
aws eks associate-access-policy \
  --cluster-name eks-test-cluster \
  --principal-arn arn:aws:iam::424727766526:role/AmazonEKSCapabilityArgoCDRole \
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
  --access-scope type=cluster
```

```
mattlewis@Matts-MacBook-Pro-2 argocd % aws eks associate-access-policy \
  --cluster-name eks-test-cluster \
  --principal-arn arn:aws:iam::424727766526:role/AmazonEKSCapabilityArgoCDRole \
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
  --access-scope type=cluster
{
    "clusterName": "eks-test-cluster",
    "principalArn": "arn:aws:iam::424727766526:role/AmazonEKSCapabilityArgoCDRole",
    "associatedAccessPolicy": {
        "policyArn": "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy",
        "accessScope": {
            "type": "cluster",
            "namespaces": []
        },
        "associatedAt": "2026-01-08T10:46:19.969000+00:00",
        "modifiedAt": "2026-01-08T10:46:19.969000+00:00"
    }
}
```


EKS Capabilities comes integrated with AWS Secrets Manager, so you can store Git secrets in Secrets Manager and just reference the Secrets Manager ARN for repository resources.




# Get your Identity Center instance ARN (replace region if your IDC instance is in a different region)


The information you add the the Authentication access section tells Argo CD the location of the IAM Identity Center to use to authenticate Argo CD to the cluster. Once you identify the region that contains the identity center and the IAM identity center instance, you need to choose RBAC user and group roles to allow Argo CD access to EKS cluster features.

The Argo CD IDC instance identifies the name of the IAM Identity Center instance that is used by your organization to get permissions for Argo CD to access your EKS cluster. Once the capability has been created, the Argo CD IDC instance cannot be edited. An IAM Identity Center instance is:

A centralized identity store for your organization

A single sign-on (SSO) portal where users authenticate once to access multiple AWS accounts and applications

A management console for administrators to control user access, permissions, and group memberships

The users and groups you identify from your IDC instance defines the permissions that the Argo CD capability has to access your EKS cluster


Specify the Argo CD RBAC mappings for your IAM Identity Center Users and Groups. These mappings link your IAM Identity Center SSO configuration to define Argo CD access in your capability.



```bash
aws cloudformation create-stack \
  --stack-name argocd-capability-stack \
  --template-body file://argocd-capability.yaml \
  --parameters \
    ParameterKey=ClusterName,ParameterValue=eks-test-cluster \
    ParameterKey=IdentityCenterInstanceArn,ParameterValue=arn:aws:sso:::instance/ssoins-753591926c609926 \
    ParameterKey=IdentityCenterRegion,ParameterValue=eu-west-2 \
    ParameterKey=AdminUserId,ParameterValue=9c671ed579-0f6d3d04-dc95-4ee1-b08a-c5f6d966c516 \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-2
```

```bash
aws cloudformation delete-stack \
  --stack-name argocd-capability-stack \
  --region eu-west-2
```



```bash
argocd % aws eks list-associated-access-policies \
  --cluster-name eks-test-cluster \
  --principal-arn arn:aws:iam::424727766526:role/ArgoCDCapabilityRole

{
    "associatedAccessPolicies": [
        {
            "policyArn": "arn:aws:eks::aws:cluster-access-policy/AmazonEKSArgoCDClusterPolicy",
            "accessScope": {
                "type": "cluster",
                "namespaces": []
            },
            "associatedAt": "2026-01-08T17:54:25.326000+00:00",
            "modifiedAt": "2026-01-08T17:54:25.326000+00:00"
        },
        {
            "policyArn": "arn:aws:eks::aws:cluster-access-policy/AmazonEKSArgoCDPolicy",
            "accessScope": {
                "type": "namespace",
                "namespaces": [
                    "argocd"
                ]
            },
            "associatedAt": "2026-01-08T17:54:25.057000+00:00",
            "modifiedAt": "2026-01-08T17:54:25.057000+00:00"
        }
    ],
    "clusterName": "eks-test-cluster",
    "principalArn": "arn:aws:iam::424727766526:role/ArgoCDCapabilityRole"
}
```


AWS do install the CRDs in our cluster, so we are still in full control of our application. Custom resources are installed and managed for you.


```
argocd % kubectl get crds | grep argo       
applications.argoproj.io                        2026-01-08T10:19:19Z
applicationsets.argoproj.io                     2026-01-08T10:19:19Z
appprojects.argoproj.io                         2026-01-08T10:19:20Z
```


