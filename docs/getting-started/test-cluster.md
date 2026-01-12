---
sidebar_position: 4
---

# Test EKS Cluster

## Testing the cluster

With the cluster started we can run the following command to see what pods are running in the cluster across all namespaces.

```bash
kubectl get pods -A
```

This returns `No resources found` in the Auto Mode cluster. We follow that up by looking at the custom resource definitions in the cluster.

```bash
% kubectl get crds

NAME                                            CREATED AT
applicationnetworkpolicies.networking.k8s.aws   2025-12-15T13:12:45Z
clusternetworkpolicies.networking.k8s.aws       2025-12-15T13:12:45Z
clusterpolicyendpoints.networking.k8s.aws       2025-12-15T13:12:45Z
cninodes.eks.amazonaws.com                      2025-12-15T13:16:12Z
cninodes.vpcresources.k8s.aws                   2025-12-15T13:12:45Z
ingressclassparams.eks.amazonaws.com            2025-12-15T13:16:12Z
nodeclaims.karpenter.sh                         2025-12-15T13:16:17Z
nodeclasses.eks.amazonaws.com                   2025-12-15T13:16:17Z
nodediagnostics.eks.amazonaws.com               2025-12-15T13:16:18Z
nodepools.karpenter.sh                          2025-12-15T13:16:17Z
policyendpoints.networking.k8s.aws              2025-12-15T13:12:44Z
securitygrouppolicies.vpcresources.k8s.aws      2025-12-15T13:12:45Z
targetgroupbindings.eks.amazonaws.com           2025-12-15T13:16:12Z
```

Here we can see that AWS install a set of AWS-owned CRDs into an Auto Mode cluster that replace components that had to previously be manually managed such as CNI config and node groups.

We can see things in here for `nodeclaims` and `nodepools` which is the underlying open-source Karpenter project that provides the node auto-scaling. We can see `targetgroupbindings` and `ingressclassparams` that come from the AWS Load Balancer Controller. The Auto Mode cluster has these CRDs managed in the control plane to enable it to be ready to serve real workloads. They are running in the control plane and not the data plane, which is why we don't see any nodes or pods.

We can retrieve detailed configuration information about the cluster from the AWS control plane using the `aws describe-cluster` command. 

```bash
aws eks describe-cluster \
--name eks-test-cluster \
--query 'cluster.{AutoMode: computeConfig, Storage: storageConfig, Network: kubernetesNetworkConfig}' 
```

This should return the following:

```yaml
{
    "AutoMode": {
        "enabled": true,
        "nodePools": [
            "general-purpose",
            "system"
        ],
        "nodeRoleArn": "arn:aws:iam::424727766526:role/eks-test-cluster-eks-auto-20251217104240154500000001"
    },
    "Storage": {
        "blockStorage": {
            "enabled": true
        }
    },
    "Network": {
        "serviceIpv4Cidr": "172.20.0.0/16",
        "ipFamily": "ipv4",
        "elasticLoadBalancing": {
            "enabled": true
        }
    }
}
```

This tells us that the cluster has Auto Mode enabled and is using the default `general-purpose` node pool. From a Storage perspective, it tells us that the cluster can provision EBS volumes, without any need to manually install and manage the EBS CSI driver. From a Network perspective, it tells us the internal CIDR range for the cluster (which is separate from the VPC CIDR range), and it shows that load balancing is enabled.

## Understanding the built-in node pool
Amazon EKS node pools offer a flexible way to manage compute resources in your Kubernetes cluster. As already mentioned, Amazon EKS provides two built-in node pools - `system` and `general-purpose` - which you cannot modify, but you can enable or disable. 

The `system` node pool has a `CriticalAddonsOnly` taint. Many EKS add-ons such as CoreDNS tolerate this taint. This node pool is used to separate cluster-critical applications.

The `general-purpose` node pool provides support for launching nodes for general purpose workloads. It supports only `amd64` architecture. 

Both built-in node pools:
* Use the default EKS NodeClass
* Use only on-demand EC2 capacity
* Use the C, M, and R EC2 instance families
* Require generation 5 or newer EC2 instances

With our setup, we will be using the built-in `general-purpose` node pool. To see more details, we can run the following command:

```bash
kubectl describe nodepool general-purpose
```

This returns detailed information about the node pool. This includes details about cost optimisation settings. The snippet below states that at most 10% of the nodes in the pool can be disrupted at any one time. Disruption includes actions such as being drained, terminated or replaced. After a node becomes a candidate for consolidation, Auto Mode will wait 30 seconds before acting. This prevents immediate scale-down and acts as a cool-down period. The consolidation policy of `WhenEmptyOrUnderutilized` means that Auto Mode will only consolidate nodes where they are empty (no pods running on them) or under utilised (so pods can fit onto other nodes).

```yaml
Spec:
  Disruption:
    Budgets:
      Nodes:               10%
    Consolidate After:     30s
    Consolidation Policy:  WhenEmptyOrUnderutilized
```

The `Template` section details the rules and lifecycle for every EC2 instance launched by Auto Mode in this node pool. `Expire After:  336h` means that nodes will be rotated after 336 hours (14 days). It tells Auto Mode to use the default NodeClass when launching instances. It then sets out the requirements which act as hard constraints. Only `on-demand` instance types are supported so no spot instances. EC2 instances are constrained to one of the following instance categories:
* c - compute optimised
* m - general-purpose
* r - memory-optimised

Only 5th generation and newer instances are supported. All nodes must be Linux (amd64) which means Windows is not supported, nor ARM/Graviton nodes. The `Termination Grace Period:  24h0m0s` means that when a node is selected for termination, Auto Mode gets up to 24 hours to drain it.

```yaml
  Template:
    Metadata:
    Spec:
      Expire After:  336h
      Node Class Ref:
        Group:  eks.amazonaws.com
        Kind:   NodeClass
        Name:   default
      Requirements:
        Key:       karpenter.sh/capacity-type
        Operator:  In
        Values:
          on-demand
        Key:       eks.amazonaws.com/instance-category
        Operator:  In
        Values:
          c
          m
          r
        Key:       eks.amazonaws.com/instance-generation
        Operator:  Gt
        Values:
          4
        Key:       kubernetes.io/arch
        Operator:  In
        Values:
          amd64
        Key:       kubernetes.io/os
        Operator:  In
        Values:
          linux
      Termination Grace Period:  24h0m0s
```

If you are interested you can find out more details about the `default` nodeclass by running the following command:

```bash
kubectl describe nodeclass default
```

There are a number of points to note in the information that gets returned from this command. The ephemeral storage assigned is explicitly configured. This defines the local disk that gets attached to each EC2 worker node created from this node class. The network policy of `DefaultAllow` means that out of the box, all pods can talk to all other pods. Network policies can be layered on top to restrict this. There is also an IAM role specified. This is the role used by the worker nodes. It determines what resources can be accessed. This is the Node IAM role as described previously. Finally, the 3 private subnets are specified, which are the subnets in which nodes launched by this node class can be placed.

```yaml
Spec:
  Ephemeral Storage:
    Iops:                     3000
    Size:                     80Gi
    Throughput:               125
  Network Policy:             DefaultAllow
  Network Policy Event Logs:  Disabled
  Role:                       eks-test-cluster-eks-auto-20251219093036388300000001
  Security Group Selector Terms:
    Id:         sg-0d3b110af6805094f
  Snat Policy:  Random
  Subnet Selector Terms:
    Id:  subnet-0fd50e5787e3fd1fd
    Id:  subnet-003225e87eb09914e
    Id:  subnet-005c5f205160af6ba
```

Nodes will only attach to one security group. This is important because it controls node-to-node, node-to-control plane and egress rules. 

```yaml
  Security Groups:
    Id:    sg-0d3b110af6805094f
    Name:  eks-cluster-sg-eks-test-cluster-1909116673
```