---
sidebar_position: 2
---

# Setup Amazon VPC

This section runs through the terraform configuration used when deploying the Amazon VPC.

The choice was made to use the community Terraform modules to create the VPC and EKS Auto Mode, as this requires less code and uses built-in best practices. In this section we will run through exactly what gets created.

## Terraform Modules
The following community Terraform modules are used:

* **VPC Module `terraform-aws-modules/vpc/aws` (v6.5.1)** - this creates the VPC, subnets, NAT Gateway, Elastic IP, Internet Gateway and route tables
* **EKS Module `terraform-aws-modules/eks/aws` (v21.10.1)** - this creates the EKS cluster, roles and Auto Mode configuration

## VPC creation
The VPC is created using the VPC module.

The initial configuration creates a VPC using the cluster name, and the CIDR range in the input variables.

```hcl
# VPC Module
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.5.1"

  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr
  ...
}
```

The next line takes the first three availability zones in the list of availability zones for a given AWS region.

```hcl
azs = slice(data.aws_availability_zones.available.names, 0, 3)
```  

The next section creates the single public subnet and 3 private subnets. Given a CIDR range of `10.0.0.0/16` for a VPC, this will create a public subnet in the first AZ of `10.0.0.0/24`, and then 3 private subnets spread across the 3 AZs of `10.0.3.0/24`, `10.0.4.0/24` and `10.0.5.0/24`.

```hcl
  # Cost-optimized setup: 1 public subnet, 3 private subnets
  public_subnets  = [cidrsubnet(var.vpc_cidr, 8, 0)]
  private_subnets = [
    cidrsubnet(var.vpc_cidr, 8, 3),
    cidrsubnet(var.vpc_cidr, 8, 4),
    cidrsubnet(var.vpc_cidr, 8, 5)
  ]
```

The next section turns NAT Gateways on so that private subnets can access the internet. It specifies setting up 1 NAT Gateway in the public subnet and automatically creates 1 Elastic IP address.

```hcl
  # Cost optimization: single NAT gateway
  enable_nat_gateway     = true
  single_nat_gateway     = true
  one_nat_gateway_per_az = false
```
This results in a setup as follows:

```
Private Subnet (AZ A) ─┐
Private Subnet (AZ B) ─┼─▶ NAT GW (AZ A) ─▶ Internet Gateway
Private Subnet (AZ C) ─┘
```
The next section sets up AWS DNS resolution within the VPC. This means that instances can resolve DNS names using the AWS-provided VPC DNS resolver.

```hcl
  enable_dns_hostnames = true
  enable_dns_support   = true
```

The next section places tags on the subnets, specifically to enable Amazon EKS to know where to place load balancers when `Kubernetes Services` are created. The first tag marks the public subnet as eligible for internet-facing load balancers. The second tag marks the private subnets as eligible for internal load balancers.


```hcl
  # EKS-specific tags
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
```
The final section tags the VPC, subnets, security groups and elastic IP to associate them with the Amazon EKS cluster and indicates that the subnet may be used by multiple clusters.

```hcl
  tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
```
