---
sidebar_position: 1
---

# Evolution of EKS

Amazon EKS was launched in preview at re:Invent in 2017. It provided a fully managed control plane for each cluster, with three Kubernetes masters across three Availability Zones to ensure high availability. Over the years that have followed, much work and innovation has taken place to move the needle for the responsibility for managing and operating EKS from the customer to AWS.

## Evolution of Compute on Amazon EKS
On the compute side, significant effort was originally required to manually setup and manage EKS worker nodes. Firstly, you needed to provision and manage the underlying EC2 instances. This included ensuring components such as `containerd`, `kubelet` and the `AWS IAM Authenticator` were installed. It involved configuring any required plugins, IAM roles and policies. These EC2 instances also needed to be registered with the cluster. 

The next fundamental improvement came in 2019 with the launch of **Amazon EKS managed node groups**. With this, Amazon EKS would provision and manage the underlying EC2 instances as worker nodes, as part of an EC2 Auto Scaling Group. You could create, update or terminate a node with a single operation. When updating or terminating a node, EKS would handle these operations gracefully by automatically draining nodes to ensure applications stayed available. Futher enhancements allowed for node configuration and customisation through EC2 Launch Templates and custom AMIs, alongside support for EC2 spot instances

At re:Invent in 2024, Amazon EKS evolved even further with the launch of **Auto Mode**. This extended the AWS managed portion of the cluster to include the worker nodes on the data plane, their components and core cluster capabilities.

![EKS Auto Mode Shared Responsibility](../../static/img/auto-mode-shared-responsibility.jpg)

Now, AWS is responsible for the configuration, patching and health of the EC2 instances by using `EC2 managed instances`. Auto Mode automatically provisions worker nodes, selecting the optimum compute instances, and dynamically scales the nodes using its own implementation of `Karpenter`. These EC2 instances run in an AWS service account, and are attached to your customer VPC using an ENI. This provides delegated operational control of the instances to AWS, leaving you responsible for the containers and pods deployed on them. Auto Mode also provides pre-configured Amazon VPC CNI, EBS CSI drivers, and load balancer controllers that work together seamlessly.

## Evolution of features inside EKS cluster
When Amazon EKS was first launched, AWS provided the managed control plane, but you were responsible for all system components that ran inside the cluster. This involved installing components manually using Helm charts or kubectl manifests. Examples of these included the ALB Ingress Controller, EBS CSI Driver, Cluster Autoscaler and the VPC CNI plugin. You were responsible for tracking available versions and installing updates after upgrading a cluster’s Kubernetes version.

The next evolution was announced at re:Invent 2020 with the introduction of **Amazon EKS Add-ons**. An add-on is software that provides supporting operational capabilities to Kubernetes applications such as observability agents or Kubernetes drivers, that allow the cluster to interact with underlying AWS resources for networking, compute, and storage. AWS provide a curated set of add-ons for EKS clusters. 

In some cases, these add-ons are automatically installed (such as `VPC CNI`, `CoreDNS` and `kube-proxy`), some are automatically installed if you enable the feature (such as Pod identity agent when you enable Pod Identity), whilst others are optional. AWS guarantee the version compatibility, and provide a lifecycle API with standardised API operations to manage the entire lifecycle of the components from creating, updating through to uninstalling.

This evolved further with **Auto Mode**. With Auto Mode, EKS core add-ons are implicit and invisible. These become abstracted away from the customer entirely, although self-managed add-ons remain unchanged.

And this brings us to now, where at re:Invent 2025 AWS launched **EKS Capabilities**, the first time that EKS has had a new feature layer. This is moving beyond managing cluster lifecycle to also help build and scale with Kubernetes. At its heart, it is moving common platform components required to operate an EKS cluster that have always been managed by the customer to become AWS's responsibility. It is providing an even higher level of abstraction that incorporates platform tooling, making it even easier to get started.


EKS Capabilities today provide Kubernetes-native features for declarative continuous deployment (Argo CD), AWS resource management (AWS Controllers for Kubernetes or `ACK`), and Kubernetes resource authoring and orchestration (Kubernetes Resource Orchestrator or `KRO`), all fully managed by AWS. With EKS Capabilities, AWS are running all of the controllers and their dependencies in AWS-owned service accounts. Argo CD, ACK and KRO are fully run in EKS infrastructure, and don't take up compute resources in your clusters. AWS manage the lifecycle including patching, scaling, resilience and availability.
