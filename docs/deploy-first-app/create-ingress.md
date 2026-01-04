---
sidebar_position: 1
---

# Create Ingress Class
The first step is to create a Kubernetes `IngressClass`. The IngressClass defines how EKS Auto Mode handles Ingress resources. This step configures the load balancing capability of EKS Auto Mode. When you create Ingress resources for your applications, EKS Auto Mode uses this IngressClass to automatically provision and manage load balancers, integrating your Kubernetes applications with AWS load balancing services.

The `ingressclass.yaml` file can be found in the `./k8s/2048/` folder in the code repository. It declares a cluster-scoped resource that represents an Ingress controller type. The `metadata` section names the IngressClass as `alb` which allows it to be referenced by this name in other specifications. It also marks it as the default IngressClass for the cluster, so any Ingress resource without a `spec.ingressClassName` will be handled by this class. The `spec` section tells Kubernetes that the controller is `eks.amazonaws.com/alb`, which is the controller string used by the AWS Load Balancer Controller.

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: alb
  annotations:
    ingressclass.kubernetes.io/is-default-class: "true"
spec:
  controller: eks.amazonaws.com/alb
```

In a terminal window, run the following command to apply this IngressClass to the cluster:

```bash
kubectl apply -f ingressclass.yaml
```

