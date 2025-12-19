import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Amazon EKS',
    Svg: require('@site/static/img/amazon-eks.svg').default,
    description: (
      <>
        Amazon Elastic Kubernetes Service (EKS) provides a fully managed 
        Kubernetes service that eliminates the complexity of operating Kubernetes clusters
      </>
    ),
  },
  {
    title: 'EKS Auto Mode',
    Svg: require('@site/static/img/amazon-eks-auto-mode.svg').default,
    description: (
      <>
        With the Auto Mode feature, EKS extends its control to manage nodes on the data plane.
        This includes automatically provisioning infrastructure, selecting optimal compute 
        instances, dynamically scaling resources and more.
      </>
    ),
  },
  {
    title: 'EKS Capabilities',
    Svg: require('@site/static/img/amazon-eks-capabilities.svg').default,
    description: (
      <>
        Amazon EKS Capabilities is a layered set of fully managed cluster features that 
        help accelerate developer velocity and offload the complexity of building and 
        scaling with Kubernetes
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
