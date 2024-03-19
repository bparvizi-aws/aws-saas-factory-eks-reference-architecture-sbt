# SaaS Amazon EKS Reference Architecture

**[Feedback & Feature request](https://www.pulse.aws/survey/XHZBD2KH)** 

The code provide here is intended to provide a sample implementation of a SaaS Amazon EKS solution. The goal is to provide SaaS developers and architects with working code that will illustrate how multi-tenant SaaS applications can be design and delivered on AWS. The solution covers a broad range of multi-tenant considerations, including tenant isolation, identity, data partitioning, and deployment. It provides developers with a prescriptive approach the fundamentals of building SaaS solution with EKS. The focus here is more on giving developers a view into the working elements of the solution without going to the extent of making a full, production-ready solution. Instead, we're hoping this can jump start your process and address some of the common challenges that teams must address when delivering a SaaS solution with EKS.

This version of the EKS reference architecture is integrated with [SaaS Builder Toolkit (SBT)](https://github.com/awslabs/sbt-aws).  SBT will provision a control plane for the SaaS application and this version of the EKS reference architecture provides the application plane.

Note that the instructions below are intended to give you step-by-step, how-to instructions for getting this solution up and running in your own AWS account. For a general description and overview of the solution, please see the [developer's guide here](GUIDE.md).

## Setting up the environment

> :warning: The Cloud9 workspace should be built by an IAM user with Administrator privileges, not the root account user. Please ensure you are logged in as an IAM user, not the root account user.

1. Create new Cloud9 Environment
    * Launch Cloud9 in your closest region Ex: `https://us-west-2.console.aws.amazon.com/cloud9/home?region=us-west-2`
    * Select Create environment
    * Name it whatever you want, click Next.
    * Choose “t3.small” for instance type, "Amazon Linux 2" for platform, take all default values for other options and click Create environment
2. Create EC2 Instance Role
    * Follow this [deep link](https://console.aws.amazon.com/iam/home#/roles$new?step=review&commonUseCase=EC2%2BEC2&selectedUseCase=EC2&policies=arn:aws:iam::aws:policy%2FAdministratorAccess) to create an IAM role with Administrator access.
    * Confirm that AWS service and EC2 are selected, then click Next to view permissions.* Confirm that AdministratorAccess is checked, then click `Next: Tags` to assign tags.
    * Take the defaults, and click `Next: Review` to review.
    * Enter `eks-ref-arch-admin` for the Name, and click `Create role`.
3. Remove managed credentials and attach EC2 Instance Role to Cloud9 Instance
    * Click the gear in the upper right-hand corner of the IDE which opens settings. Click the `AWS Settings` on the left and under `Credentials` slide the button to the left for `AWS Managed Temporary Credentials. The button should be greyed out when done with an x to the right indicating it's off.  You can also delete ~/.aws/credentials to make sure you are not using managed credentials.
    * Click the round Button with an alphabet in the upper right-hand corner of the IDE and click `Manage EC2 Instance`. This will take you the EC2 portion of the AWS Console
    * Right-click the EC2 instance and in the fly-out menu, click `Security` -> `Modify IAM Role`
    * Choose the Role you created in step 3 above. It should be titled "eks-ref-arch-admin" and click `Save`.
4. Clone the repo and run the setup script
    * Return to the Cloud9 IDE
    * In the upper left part of the main screen, click the round green button with a `+` on it and click `New Terminal`
    * Enter the following in the terminal window

    ```bash
    git clone https://github.com/aws-samples/aws-saas-factory-eks-reference-architecture
    cd ~/aws-saas-factory-eks-reference-architecture/scripts
    chmod +x *.sh
    ./setup-eks-v1.sh
   ```

   This [script](./scripts/setup-eks-v1.sh) sets up all Kubernetes tools, updates the AWS CLI and installs other dependencies that we'll use later. Take note of the final output of this script. If everything worked correctly, you should see the message that the you're good to continue creating the EKS cluster. If you do not see this message, please do not continue. Ensure that the Administrator EC2 role was created and successfully attached to the EC2 instance that's running your Cloud9 IDE. Also ensure you turned off `AWS Managed Credentials` inside your Cloud9 IDE (refer to step 3).

5. We will need to increase the disk volume for our Cloud9 instance.

   ```bash
    cd ~/aws-saas-factory-eks-reference-architecture/scripts
    ./increase-disk-size.sh
   ```

6. Deploying the solution

   Execute the below command by providing an email Id. This email address will be used by the SaaS administrator to login to the "Admin" application. A temporary password will be sent to this email address.

    ```
    cd ~/aws-saas-factory-eks-reference-architecture/scripts
    ./install.sh your@email.com
    ```

    This process will take about 40 - 45 minutes to complete.
    
   **NOTE**: We are currently tracking one open issue where, at times, during the deployment process the SaaSApi stack fails with a message that the Network Load Balancer (NLB) is not in an active state. If you see this issue, the current workaround is to navigate to the Amazon Cloud9 console and run the same npm run deploy command that you used previously to create the stack. It is important to ensure you use the same command that you ran previously with the same parameters, and it could be either with option 1/ without domain, 2/ with domain, or 3/with Kubecost. After you execute the command, the stack creation will continue from where it left off and the SaaSApi stack will complete successfully. Meanwhile, we are working on a solution to address this issue.


7. After the deployment is complete, if you want to inspect the services deployed within the Amazon EKS cluster, you  will need to provide Cloud9 access to the cluster. For this, go to the Cloudformation console, and look for the stack named *EKSSaaSCluster*. Go to the *Outputs* tab and look for the key *SaaSClusterConfigCommand*. Copy the entire value, which should start with "aws eks update-kubeconfig --name EKSSaaS", and then run the command in your Cloud9 terminal. You should see an output that starts with "Updated context.." which means the local Kubeconfig file has the necessary details  to access your EKS clustr

Now, run the below command to access the EKS cluster and the services deployed within the cluster.

    ***kubectl get nodes***

    To access the deployed pods in the default namespace, run the below command

    ***kubectl get pods***
   

8. API endpoints are created for SBT as part of the provisioning process.  In order to interact with SBT control plane, you can submit requests to its APIs.  Please see examples aws-saas-factory-eks-reference-architecture/scripts/run-basic-queries.sh.  We've also created a few scripts as examples.
   
   - create-new-tenant.sh
   - delete-tenant.sh
   - list-all-tenants.sh
   - delete-tenant.sh

## Cleanup

Since AWS CDK was used to provision all of the required resources in this reference solution, cleaning up is relatively straightforward. CD in to the directory `aws-saas-factory-eks-reference-architecture` and then execute the command `cdk destroy --all`. 

Go to Cloud9 terminal and run the below commands:

    ```bash
    cd ~/aws-saas-factory-eks-reference-architecture/scripts
    ./cleanup.sh
    ```

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

