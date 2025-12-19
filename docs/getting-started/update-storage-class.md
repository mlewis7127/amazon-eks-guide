---
sidebar_position: 5
---

# Update Storage Class

## Storage Class
In the previous commands we can see the cluster can provision EBS volumes, so the next thing is to check what storage classes are available. A storage class tells the cluster details such as which type of storage service to use (e.g. EBS/EFS) and what volume type and/or performance settings.

```bash
kubectl get storageclass

NAME   PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
gp2    kubernetes.io/aws-ebs   Delete          WaitForFirstConsumer   false                  126m
```

This shows us that the cluster has been provisioned using a legacy storage class. EKS Auto Mode does not create a StorageClass for you. You must create a StorageClass referencing `ebs.csi.eks.amazonaws.com` to use the storage capability of EKS Auto Mode. We could do this at cluster creation time in Terraform. However, Hashicorp guidance states "Single-apply workflows are not a reliable way of deploying Kubernetes infrastructure with Terraform. We strongly recommend separating the EKS Cluster from the Kubernetes resources. They should be deployed in separate runs, and recorded in separate state files." [Link](https://support.hashicorp.com/hc/en-us/articles/4408936406803-Kubernetes-Provider-block-fails-with-connect-connection-refused)

Therefore, we will create a new `gp3` storage class which is available at `./k8s/storage-class/storage-class.yaml` in the code repository. It creates a StorageClass named `auto-ebs-sc` that applications can reference when requesting storage. We also set this storage class as the default. We use a topology constrainty to restrict the volumes so they are only created in availability zones where Auto Mode can provision nodes. We also specify the modern EBS driver which is `ebs.csi.eks.amazonaws.com`. The `volumeBindingMode` of `WaitForFirstConsumer` delays volume creation until a pod needs it. We also mandate that the storage volume can be resized and must the gp3 storage type and be encrypted at rest.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: auto-ebs-sc
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
allowedTopologies:
- matchLabelExpressions:
  - key: eks.amazonaws.com/compute-type
    values:
    - auto
provisioner: ebs.csi.eks.amazonaws.com
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
parameters:
  type: gp3
  encrypted: "true"
```

We can navigate to the correct directory and run the following command to apply this configuration.

```bash
kubectl apply -f storage-class.yaml
```

And we will see that the storage class has been created.

```bash
storageclass.storage.k8s.io/auto-ebs-sc created
```

We will now see this appear when we view the storage classes available.

```bash
kubectl get storageclass
NAME                    PROVISIONER                 RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
auto-ebs-sc (default)   ebs.csi.eks.amazonaws.com   Delete          WaitForFirstConsumer   true                   60s
gp2                     kubernetes.io/aws-ebs       Delete          WaitForFirstConsumer   false                  120m
```

As this is a new cluster, we can delete the `gp2` storage class by running `kubectl delete storageclass gp2` if we want too.