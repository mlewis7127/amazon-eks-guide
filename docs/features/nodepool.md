---
sidebar_position: 2
---

# Add a Karpenter NodePool

## Background

In November 2019, AWS introduced the concept of Amazon EKS Managed Node Groups. With this, Amazon EKS would provision and manage the underlying EC2 instances as worker nodes, as part of an EC2 Auto Scaling Group. You could create, update or terminate a node with a single operation. When updating or terminating a node, EKS would handle these operations gracefully by automatically draining nodes to ensure applications stayed available. Futher enhancements allowed for node configuration and customisation through EC2 Launch Templates and custom AMIs, alongside support for EC2 spot instances.

However, the modern trend in Kubernetes is moving away from static node groups to dynamic node provisioning with tools like Karpenter for more flexible and cost-effective infrastructure management. With Amazon EKS Auto Mode, the recommendation is no longer to create traditional node groups. Instead, you create a Karpenter NodePool that defines the compute requirements. Amazon EKS Auto Mode provides two built-in node pools - `system` and `general-purpose` - which you cannot modify, but you can enable or disable. The `general-purpose` node pool provides support for launching nodes for general purpose workloads. It supports only `amd64` architecture and uses only on-demand EC2 capacity in the `C`, `M` or `R` instance families.

* What happens if you want to take advantage of spot instances?
* What happens if you want to take advantage of Graviton?

Let's show how you can create a node pool to do just that.

## Creating a Karpenter NodePool

The complete configuration files for this post can be found in the `k8s\node-pool` section of the code repository. We can create it using the following command.

```bash
$ kubectl apply -f arm-nodepool.yaml
nodepool.karpenter.sh/arm-mixed-capacity created
```

The start of the `arm-nodepool.yaml` configuration file is as follows:

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: arm-mixed-capacity
```

This tells us we are using the NodePool API with Karpenter. This uses the `nodepools.karpenter.sh` CRD which is installed by default with Auto Mode. The `spec` element provides the contract with Karpenter. It has the following high-level structure, and we will go through each one in order.

``` yaml
spec:
  disruption:   # when and how nodes can be replaced
  template:     # what a node looks like
  limits:       # optional safety rails
  weight:       # optional priority
```

### Disruption

The disruption section describes the ways in which Karpenter can disrupt and replace nodes. This is used when Karpenter wants to remove empty nodes, replace under-utilised nodes with better fitting ones, or shrink the cluster to save money.

```yaml
  # Disruption settings for node lifecycle management
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 10m  # Wait 10 minutes before consolidating
    
    # Disruption budgets to control how many nodes can be disrupted
    budgets:
      # During business hours: more conservative
      - nodes: "2"
        schedule: "0 9 * * mon-fri"  # 9 AM Mon-Fri
        duration: 8h
      # Outside business hours: more aggressive
      - nodes: "10%"
```

The `consolidationPolicy` describes which types of nodes Karpenter should consider for consolidation. There are 2 options:

* `WhenEmptyOrUnderutilized` - Karpenter will consider all nodes for consolidation and attempt to remove or replace nodes when it discovers that the node is empty or underutilised and could be changed to reduce cost
* `WhenEmpty` - Karpenter will only consider nodes for consolidation that contain no workload pods

The `consolidateAfter` field is the amount of time Karpenter should wait to consolidate a node after a pod has been added or removed from the node. We set this to 10 minutes to make sure the behaviour is not too aggressive, and gives the scheduler time to stabilise.

Disruption budgets are used to control how many nodes can be disrupted. There are two rules defined in this section. The first rule states that between 09:00 and 17:00 on Monday to Friday, Karpenter may disrupt at most 2 nodes at a time. The second rule states that Karpenter may disrupt up to 10% of all nodes at any time. This will not apply between 09:00-17:00 on Monday to Friday as the first rule is more restrictive and so wins out.


### Template

The `template` section defines the exact shape, rules and constraints of every node that Karpenter is allowed to create as part of this NodePool.

```yaml
  # Node template specification
  template:
    spec:
      # Termination grace period (24 hours)
      terminationGracePeriod: 24h
      
      # Node requirements
      requirements:
        # ARM architecture
        - key: kubernetes.io/arch
          operator: In
          values: ["arm64"]
        
        # Support spot and on-demand (prefer spot for cost)
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        
        # ARM instance types (Graviton) - diverse selection
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            # General purpose (M7g)
            - "m7g.medium"
            - "m7g.large"
            - "m7g.xlarge"
            - "m7g.2xlarge"
            # Burstable (T4g) - cost-effective for variable workloads
            - "t4g.medium"
            - "t4g.large"
            - "t4g.xlarge"
            # Compute optimized (C7g)
            - "c7g.large"
            - "c7g.xlarge"
            # Memory optimized (R7g)
            - "r7g.large"
            - "r7g.xlarge"
      
      # Node class reference (Auto Mode creates this automatically)
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: default


      # Taints (optional - for dedicated ARM workloads)
      taints:
        - key: arch
          value: arm64
          effect: NoSchedule
```

The `terminationGracePeriod` field defines the amount of time that a node can be draining before Karpenter forcibly cleans it up.

The `spec.requirements` section provides more details about the nodes that can be created. There are a specified here as an example.

The `kubernetes.io/arch` key sets out the architecture for the node. Karpenter supports `amd64` and `arm64` nodes. This is how we support Graviton.

The `karpenter.sh/capacity-type` key is analogous to EC2 puchase options. The `general-purpose` NodePool only supports `on-demand` as a value, whereas he we specify both `spot` and `on-demand`. As multiple capacity types are specified, Karpenter will prioritise `spot` where available, but fallback to on-demand.

:::info
AWS automatically applies Amazon EC2 Reserved Instance discounts to matching running on-demand EC2 usage, regardless of how these instances were launched. This means that you will get these discounts for instances launched by Karpenter
:::

There are a number of instance type options

* key: node.kubernetes.io/instance-type
* key: karpenter.k8s.aws/instance-family
* key: karpenter.k8s.aws/instance-category
* key: karpenter.k8s.aws/instance-generation
* key: karpenter.k8s.aws/instance-capability-flex

:::info
Generally, instance types should be a list and not a single value. Leaving these requirements undefined is recommended, as it maximizes choices for efficiently placing pods.
:::

Each NodePool must reference a NodeClass. A Node Class defines infrastructure-level settings that apply to groups of nodes in your EKS cluster, including network configuration, storage settings, and resource tagging. When you need to customize how EKS Auto Mode provisions and configures EC2 instances beyond the default settings, creating a Node Class gives you precise control over critical infrastructure parameters. For example, you can specify private subnet placement for enhanced security, configure instance ephemeral storage for performance-sensitive workloads, or apply custom tagging for cost allocation. In this case, we just reference the default Auto Mode NodeClass.

There is also an example shown on how to apply a `taint` to a NodePool. When a taint is applied to a NodePool, Karpenter will only place pods on the nodes that explicitly tolerate the taint. In the example, Karpenter will only place a workload on the node that explicitly states that it supports the ARM architecture.

```yaml
# Toleration for the taint (if you added one)
tolerations:
- key: arch
    operator: Equal
    value: arm64
    effect: NoSchedule
```

### Limits

The limits section is used to constrain the total size of the NodePool. The limits that are set prevent Karpenter from creating new instances, once they have been exceeded. This is done to prevent runaway costs.

```yaml
  # Limits for this node pool
  limits:
    cpu: "1000"
    memory: 1000Gi
```

### Weight

The `weight` field controls prioritisation when Karpenter has multiple NodePools to choose from for scheduling a pod. When multiple NodePools can satisfy the requirements for a pod, Karpenter will give priority to the NodePool with the highest weight. If the `weight` attribute is not specified, it will default to 0.

```yaml
  # Weight for prioritization (higher = preferred)
  weight: 10
```

Karpenter will look to choose the cheapest feasible instance. It prefers NodePools where it can pack the pod more efficiently with other pending pods, and minimise wasted CPU / memory on the node.

:::info
Based on the way that Karpenter performs pod batching and bin packing, it is not guaranteed that Karpenter will always choose the highest priority NodePool given specific requirements. For example, if a pod can’t be scheduled with the highest priority NodePool, it will force creation of a node using a lower priority NodePool, allowing other pods from that batch to also schedule on that node. The behavior may also occur if existing capacity is available, as the kube-scheduler will schedule the pods instead of allowing Karpenter to provision a new node.
:::

## Targetting the NodePool with a Deployment

In order to test the NodePool and show it working, we created a Deployment, which is a simple Nginx container. It can be deployed using the following command from the code repository.

```bash
$ kubectl apply -f arm-deployment.yaml
deployment.apps/arm-app created
```

We define a Deployment and give it the name of `arm-app`, which is also assigned a label of the same name.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: arm-app
  labels:
    app: arm-app
```

The next part of the manifest file tells Kubernetes to run 3 copies of the application, and to make sure they are labelled as `app=arm-app`

```yaml
spec:
  replicas: 3
  selector:
    matchLabels:
      app: arm-app
  template:
    metadata:
      labels:
        app: arm-app
```

The manifest file then defines a `nodeSelector` which is a rule that states that these pods can only run on nodes with an architecture type of `arm64`. This matches the architecture of our NodePool. Kubernetes will only schedule the Pod onto nodes that match the labels specified.

```yaml
# Node selector for ARM architecture
nodeSelector:
  kubernetes.io/arch: arm64
```

The next part of the manifest file moves onto `affinity`. Node affinity functions like the `nodeSelector` field but is more expressive and allows you to specify soft rules. In this case, we use `preferredDuringSchedulingIgnoredDuringExecution` with a weight of 100 to state that we want the Pod to run on a Spot instance, but if this cannot be scheduled, then it is fine to drop back to on-demand. This means that the Pod will not remain in a pending state if a Spot instance was not available, and so it is considered a soft rule.


```yaml
# Prefer spot instances for cost savings
affinity:
nodeAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      preference:
        matchExpressions:
          - key: karpenter.sh/capacity-type
            operator: In
            values: ["spot"]
```

Finally, we use the `containers` section to say that we want to run a copy of nginx in each Pod, which half a CPU and 512 MB of memory reserved, but this can grow to a whole CPU and 1 GB or memory.

```yaml
containers:
  - name: nginx
    image: nginx:latest  # Multi-arch image supports ARM64
    ports:
      - containerPort: 80
        name: http
    resources:
      requests:
        cpu: 500m
        memory: 512Mi
      limits:
        cpu: 1000m
        memory: 1Gi
```

We open up a number of additional terminal windows as we apply the Deployment, to give us more information on what exactly is happening in the background.

The first command lists all the nodes in the EKS cluster including a column showing their architecture and a column showing their capacity type. We can see that a node is in the Ready state which uses ARM and is a spot instance.

```bash
$ kubectl get nodes -L kubernetes.io/arch,karpenter.sh/capacity-type
NAME                  STATUS   ROLES    AGE     VERSION               ARCH    CAPACITY-TYPE
i-0d336c28e588123ae   Ready    <none>   2m22s   v1.34.3-eks-3c60543   arm64   spot
```

The second command lists the `NodeClaim` resources. A `NodeClaim` is a custom resource created by Karpenter. Here we can see the generated `NodeClaim` name is taken from the name of the `NodePool` with a random suffix. We can also see it is using spot capacity, and a supported instance family type.

```bash
kubectl get nodeclaims
NAME                       TYPE         CAPACITY   ZONE         NODE                  READY   AGE
arm-mixed-capacity-zw6vh   m7g.xlarge   spot       eu-west-2a   i-0d336c28e588123ae   True    3m
```

The next command describes all pods that have the label `app=arm-app`. This is the label that gets applied as part of the deployment. It filters the output to show the pod lifecycle events. Again, we can see from this that the pod is running on an ARM-based Graviton spot instance. The event timeline shows the lifecycle involved here. The pod is bound to a compatible node, it then downloads the latest nginx image from the container registry, the container is then created, and finally started.

```bash
kubectl describe pod -l app=arm-app | grep -A 20 Events

Name:             arm-app-6674bd9849-ld6fm
Namespace:        default
Priority:         0
Service Account:  default
Node:             i-0d336c28e588123ae/10.1.3.225
Start Time:       Tue, 27 Jan 2026 11:42:06 +0000
Labels:           app=arm-app
                  pod-template-hash=6674bd9849
Annotations:      <none>
Status:           Running
IP:               10.1.3.97
--
Events:
  Type    Reason     Age    From               Message
  ----    ------     ----   ----               -------
  Normal  Scheduled  2m14s  default-scheduler  Successfully assigned default/arm-app-6674bd9849-ld6fm to i-0d336c28e588123ae
  Normal  Pulling    2m12s  kubelet            spec.containers{nginx}: Pulling image "nginx:latest"
  Normal  Pulled     2m9s   kubelet            spec.containers{nginx}: Successfully pulled image "nginx:latest" in 3.874s (3.874s including waiting). Image size: 61200811 bytes.
  Normal  Created    2m8s   kubelet            spec.containers{nginx}: Created container: nginx
  Normal  Started    2m8s   kubelet            spec.containers{nginx}: Started container nginx
```

We ran a similar command to list all of the pods running, and to show that the 3 replicas as specified in the deployment are running.

```bash
kubectl get pods -l app=arm-app -w
NAME                       READY   STATUS             RESTARTS   AGE
arm-app-6674bd9849-ld6fm   0/1     Pending             0          0s
arm-app-6674bd9849-76wzg   0/1     Pending             0          0s
arm-app-6674bd9849-2vnwx   0/1     Pending             0          0s
arm-app-6674bd9849-ld6fm   0/1     ContainerCreating   0          0s
arm-app-6674bd9849-76wzg   0/1     ContainerCreating   0          0s
arm-app-6674bd9849-2vnwx   0/1     ContainerCreating   0          0s
arm-app-6674bd9849-2vnwx   0/1     Running             0          7s
arm-app-6674bd9849-ld6fm   0/1     Running             0          7s
arm-app-6674bd9849-76wzg   0/1     Running             0          7s
arm-app-6674bd9849-ld6fm   1/1     Running             0          13s
arm-app-6674bd9849-76wzg   1/1     Running             0          13s
arm-app-6674bd9849-2vnwx   1/1     Running             0          13s
```



