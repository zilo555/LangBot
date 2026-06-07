# LangBot Kubernetes 部署指南 / Kubernetes Deployment Guide

[简体中文](#简体中文) | [English](#english)

---

## 简体中文

### 概述

本指南提供了在 Kubernetes 集群中部署 LangBot 的完整步骤。Kubernetes 部署配置基于 `docker-compose.yaml`，适用于生产环境的容器化部署。

### 前置要求

- Kubernetes 集群（版本 1.19+）
- `kubectl` 命令行工具已配置并可访问集群
- 集群中有可用的存储类（StorageClass）用于持久化存储（可选但推荐）
- 至少 2 vCPU 和 4GB RAM 的可用资源

### 架构说明

Kubernetes 部署包含以下组件：

1. **langbot**: 主应用服务
   - 提供 Web UI（端口 5300）
   - 处理平台 webhook（端口 2280-2290）
   - 数据持久化卷
   
2. **langbot-plugin-runtime**: 插件运行时服务
   - WebSocket 通信（端口 5400）
   - 插件数据持久化卷

3. **langbot-box**: Box 沙箱运行时服务（可选）
   - WebSocket 通信（端口 5410）
   - 为 LangBot 提供沙箱工具（exec / read / write / edit / glob / grep）、`activate` 技能工具、技能新增/编辑、以及 stdio 模式的 MCP 服务器
   - 通过挂载节点的 Docker socket 创建沙箱容器（镜像仅自带 Docker CLI，不含 dockerd / nsjail）
   - 使用 hostPath 作为工作区根目录，并通过 podAffinity 与 langbot 调度到同一节点（详见下方「Box 沙箱运行时」一节）
   - 如不需要沙箱能力，可不部署此组件，并在 langbot 上设置 `BOX__ENABLED=false`

4. **持久化存储**:
   - `langbot-data`: LangBot 主数据
   - `langbot-plugins`: 插件文件
   - `langbot-plugin-runtime-data`: 插件运行时数据
   - Box 工作区根目录使用节点上的 hostPath（`/app/data/box`），而非 PVC（原因见下方说明）

### 快速开始

#### 1. 下载部署文件

```bash
# 克隆仓库
git clone https://github.com/langbot-app/LangBot
cd LangBot/docker

# 或直接下载 kubernetes.yaml
wget https://raw.githubusercontent.com/langbot-app/LangBot/main/docker/kubernetes.yaml
```

#### 2. 部署到 Kubernetes

```bash
# 应用所有配置
kubectl apply -f kubernetes.yaml

# 检查部署状态
kubectl get all -n langbot

# 查看 Pod 日志
kubectl logs -n langbot -l app=langbot -f
```

#### 3. 访问 LangBot

默认情况下，LangBot 服务使用 ClusterIP 类型，只能在集群内部访问。您可以选择以下方式之一来访问：

**选项 A: 端口转发（推荐用于测试）**

```bash
kubectl port-forward -n langbot svc/langbot 5300:5300
```

然后访问 http://localhost:5300

**选项 B: NodePort（适用于开发环境）**

编辑 `kubernetes.yaml`，取消注释 NodePort Service 部分，然后：

```bash
kubectl apply -f kubernetes.yaml
# 获取节点 IP
kubectl get nodes -o wide
# 访问 http://<NODE_IP>:30300
```

**选项 C: LoadBalancer（适用于云环境）**

编辑 `kubernetes.yaml`，取消注释 LoadBalancer Service 部分，然后：

```bash
kubectl apply -f kubernetes.yaml
# 获取外部 IP
kubectl get svc -n langbot langbot-loadbalancer
# 访问 http://<EXTERNAL_IP>
```

**选项 D: Ingress（推荐用于生产环境）**

确保集群中已安装 Ingress Controller（如 nginx-ingress），然后：

1. 编辑 `kubernetes.yaml` 中的 Ingress 配置
2. 修改域名为您的实际域名
3. 应用配置：

```bash
kubectl apply -f kubernetes.yaml
# 访问 http://langbot.yourdomain.com
```

### 配置说明

#### 环境变量

在 `ConfigMap` 中配置环境变量：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: langbot-config
  namespace: langbot
data:
  TZ: "Asia/Shanghai"  # 修改为您的时区
```

#### 存储配置

默认使用动态存储分配。如果您有特定的 StorageClass，请在 PVC 中指定：

```yaml
spec:
  storageClassName: your-storage-class-name
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

#### 资源限制

根据您的需求调整资源限制：

```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

### Box 沙箱运行时

`langbot-box` 为 LangBot 提供代码沙箱能力,支撑以下功能:

- 原生沙箱工具:`exec` / `read` / `write` / `edit` / `glob` / `grep`
- 技能(Skill)的 `activate` 工具、技能的新增与编辑
- stdio 模式的 MCP 服务器

它是**可选组件**。不部署时,LangBot 仍可正常运行,仪表盘和技能列表只读可见,但上述沙箱相关能力会被禁用。此时请在 `langbot` Deployment 上设置 `BOX__ENABLED=false`(或在 `data/config.yaml` 中设置 `box.enabled: false`),以匹配实际部署。

#### 工作原理与关键约束

LangBot 官方镜像**只内置了 Docker CLI**(不含 dockerd,也不含 nsjail)。因此 Box 运行时通过挂载到节点的 Docker socket(`/var/run/docker.sock`)来创建沙箱容器——它本身不在 Pod 内跑 dockerd。

由此带来一个**关键约束**:负责创建沙箱容器的是**节点上的 Docker 守护进程**,它解析 bind-mount 路径时使用的是**节点文件系统**的视角。所以 Box 工作区根目录必须在以下三处是**同一个绝对路径**:

1. 节点上的实际路径
2. `langbot-box` 容器内的挂载路径
3. 它创建的每个沙箱容器内的挂载路径

这正是本 manifest 不用普通 PVC、而用 `hostPath`(固定在 `/app/data/box`)的原因:Pod 内 PVC 的路径只存在于 Pod 的 mount namespace 中,节点的 dockerd 看不到。同时,`langbot` 与 `langbot-box` 通过 `podAffinity` 被强制调度到**同一节点**,以共享这个 hostPath。

#### 连接与配置

- `langbot` 通过 WebSocket 连接 Box 运行时,端点由 ConfigMap 中的 `BOX__RUNTIME__ENDPOINT: ws://langbot-box:5410` 指定。
  > 注意:容器内默认主机名是 `langbot_box`(带下划线),而下划线不是合法的 Kubernetes DNS 名称,因此这里**必须显式**用合法的 Service 名 `langbot-box` 指定端点。
- Box 运行时**不读取**自身的 `box.local.*` / `BOX__*` 环境变量;它的配置由 LangBot 在连接时通过 INIT RPC 下发。因此 `BOX__LOCAL__*`(`HOST_ROOT` / `DEFAULT_WORKSPACE` / `SKILLS_ROOT` / `ALLOWED_MOUNT_ROOTS`)都配置在 `langbot` Deployment 上,其中 `HOST_ROOT` 必须与两侧的 `box-root` 挂载路径一致(`/app/data/box`)。

#### 安全提示

挂载节点的 Docker socket 会让 Box 运行时(以及在沙箱中执行的任意代码)获得对节点的**实质 root 权限**。请仅在你信任该工作负载的节点上部署 Box,最好使用专用节点池并配合污点/容忍(taint/toleration)隔离。若需要更强的隔离边界,可将 `box.backend` 切换为 `e2b`(设置 `E2B_API_KEY`),并移除 docker.sock 挂载与 hostPath。

#### 验证 Box 是否就绪

```bash
# 查看 Box 运行时日志(应能看到选用的 backend,例如 "using backend: docker")
kubectl logs -n langbot -l app=langbot-box -f

# 在 langbot 日志中确认已连上 Box 运行时
kubectl logs -n langbot -l app=langbot | grep -i "box runtime"
```

### 常用操作

#### 查看日志

```bash
# 查看 LangBot 主服务日志
kubectl logs -n langbot -l app=langbot -f

# 查看插件运行时日志
kubectl logs -n langbot -l app=langbot-plugin-runtime -f
```

#### 重启服务

```bash
# 重启 LangBot
kubectl rollout restart deployment/langbot -n langbot

# 重启插件运行时
kubectl rollout restart deployment/langbot-plugin-runtime -n langbot
```

#### 更新镜像

```bash
# 更新到最新版本
kubectl set image deployment/langbot -n langbot langbot=rockchin/langbot:latest
kubectl set image deployment/langbot-plugin-runtime -n langbot langbot-plugin-runtime=rockchin/langbot:latest

# 检查更新状态
kubectl rollout status deployment/langbot -n langbot
```

#### 扩容（不推荐）

注意：由于 LangBot 使用 ReadWriteOnce 的持久化存储，不支持多副本扩容。如需高可用，请考虑使用 ReadWriteMany 存储或其他架构方案。

#### 备份数据

```bash
# 备份 PVC 数据
kubectl exec -n langbot -it <langbot-pod-name> -- tar czf /tmp/backup.tar.gz /app/data
kubectl cp langbot/<langbot-pod-name>:/tmp/backup.tar.gz ./backup.tar.gz
```

### 卸载

```bash
# 删除所有资源（保留 PVC）
kubectl delete deployment,service,configmap -n langbot --all

# 删除 PVC（会删除数据）
kubectl delete pvc -n langbot --all

# 删除命名空间
kubectl delete namespace langbot
```

### 故障排查

#### Pod 无法启动

```bash
# 查看 Pod 状态
kubectl get pods -n langbot

# 查看详细信息
kubectl describe pod -n langbot <pod-name>

# 查看事件
kubectl get events -n langbot --sort-by='.lastTimestamp'
```

#### 存储问题

```bash
# 检查 PVC 状态
kubectl get pvc -n langbot

# 检查 PV
kubectl get pv
```

#### 网络访问问题

```bash
# 检查 Service
kubectl get svc -n langbot

# 检查端口转发
kubectl port-forward -n langbot svc/langbot 5300:5300
```

### 生产环境建议

1. **使用特定版本标签**：避免使用 `latest` 标签，使用具体版本号如 `rockchin/langbot:v1.0.0`
2. **配置资源限制**：根据实际负载调整 CPU 和内存限制
3. **使用 Ingress + TLS**：配置 HTTPS 访问和证书管理
4. **配置监控和告警**：集成 Prometheus、Grafana 等监控工具
5. **定期备份**：配置自动备份策略保护数据
6. **使用专用 StorageClass**：为生产环境配置高性能存储
7. **配置亲和性规则**：确保 Pod 调度到合适的节点

### 高级配置

#### 使用 Secrets 管理敏感信息

如果需要配置 API 密钥等敏感信息：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: langbot-secrets
  namespace: langbot
type: Opaque
data:
  api_key: <base64-encoded-value>
```

然后在 Deployment 中引用：

```yaml
env:
- name: API_KEY
  valueFrom:
    secretKeyRef:
      name: langbot-secrets
      key: api_key
```

#### 配置水平自动扩缩容（HPA）

注意：需要确保使用 ReadWriteMany 存储类型

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: langbot-hpa
  namespace: langbot
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: langbot
  minReplicas: 1
  maxReplicas: 3
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 参考资源

- [LangBot 官方文档](https://docs.langbot.app)
- [Docker 部署文档](https://link.langbot.app/zh/docs/docker)
- [Kubernetes 官方文档](https://kubernetes.io/docs/)

---

## English

### Overview

This guide provides complete steps for deploying LangBot in a Kubernetes cluster. The Kubernetes deployment configuration is based on `docker-compose.yaml` and is suitable for production containerized deployments.

### Prerequisites

- Kubernetes cluster (version 1.19+)
- `kubectl` command-line tool configured with cluster access
- Available StorageClass in the cluster for persistent storage (optional but recommended)
- At least 2 vCPU and 4GB RAM of available resources

### Architecture

The Kubernetes deployment includes the following components:

1. **langbot**: Main application service
   - Provides Web UI (port 5300)
   - Handles platform webhooks (ports 2280-2290)
   - Data persistence volume
   
2. **langbot-plugin-runtime**: Plugin runtime service
   - WebSocket communication (port 5400)
   - Plugin data persistence volume

3. **langbot-box**: Box sandbox runtime service (optional)
   - WebSocket communication (port 5410)
   - Backs LangBot's sandbox tools (exec / read / write / edit / glob / grep), the `activate` skill tool, skill add/edit, and stdio-mode MCP servers
   - Creates sandbox containers via the node's mounted Docker socket (the image ships only the Docker CLI — no dockerd / nsjail)
   - Uses a hostPath as its workspace root and is co-scheduled with langbot on the same node via podAffinity (see the "Box sandbox runtime" section below)
   - If you do not need the sandbox, skip this component and set `BOX__ENABLED=false` on langbot

4. **Persistent Storage**:
   - `langbot-data`: LangBot main data
   - `langbot-plugins`: Plugin files
   - `langbot-plugin-runtime-data`: Plugin runtime data
   - The Box workspace root uses a node hostPath (`/app/data/box`), not a PVC (see the explanation below)

### Quick Start

#### 1. Download Deployment Files

```bash
# Clone repository
git clone https://github.com/langbot-app/LangBot
cd LangBot/docker

# Or download kubernetes.yaml directly
wget https://raw.githubusercontent.com/langbot-app/LangBot/main/docker/kubernetes.yaml
```

#### 2. Deploy to Kubernetes

```bash
# Apply all configurations
kubectl apply -f kubernetes.yaml

# Check deployment status
kubectl get all -n langbot

# View Pod logs
kubectl logs -n langbot -l app=langbot -f
```

#### 3. Access LangBot

By default, LangBot service uses ClusterIP type, accessible only within the cluster. Choose one of the following methods to access:

**Option A: Port Forwarding (Recommended for testing)**

```bash
kubectl port-forward -n langbot svc/langbot 5300:5300
```

Then visit http://localhost:5300

**Option B: NodePort (Suitable for development)**

Edit `kubernetes.yaml`, uncomment the NodePort Service section, then:

```bash
kubectl apply -f kubernetes.yaml
# Get node IP
kubectl get nodes -o wide
# Visit http://<NODE_IP>:30300
```

**Option C: LoadBalancer (Suitable for cloud environments)**

Edit `kubernetes.yaml`, uncomment the LoadBalancer Service section, then:

```bash
kubectl apply -f kubernetes.yaml
# Get external IP
kubectl get svc -n langbot langbot-loadbalancer
# Visit http://<EXTERNAL_IP>
```

**Option D: Ingress (Recommended for production)**

Ensure an Ingress Controller (e.g., nginx-ingress) is installed in the cluster, then:

1. Edit the Ingress configuration in `kubernetes.yaml`
2. Change the domain to your actual domain
3. Apply configuration:

```bash
kubectl apply -f kubernetes.yaml
# Visit http://langbot.yourdomain.com
```

### Configuration

#### Environment Variables

Configure environment variables in ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: langbot-config
  namespace: langbot
data:
  TZ: "Asia/Shanghai"  # Change to your timezone
```

#### Storage Configuration

Uses dynamic storage provisioning by default. If you have a specific StorageClass, specify it in PVC:

```yaml
spec:
  storageClassName: your-storage-class-name
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

#### Resource Limits

Adjust resource limits based on your needs:

```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

### Box Sandbox Runtime

`langbot-box` provides the code-sandbox capability backing the following LangBot features:

- Native sandbox tools: `exec` / `read` / `write` / `edit` / `glob` / `grep`
- The skill `activate` tool, and skill add/edit
- stdio-mode MCP servers

It is an **optional component**. Without it, LangBot still runs and the dashboard / skills list remain visible (read-only), but the sandbox features above are disabled. In that case set `BOX__ENABLED=false` on the `langbot` Deployment (or `box.enabled: false` in `data/config.yaml`) to match.

#### How it works & the key constraint

The official LangBot image ships **only the Docker CLI** (no dockerd, no nsjail). The Box runtime therefore creates sandbox containers by talking to the node's Docker daemon over the mounted socket (`/var/run/docker.sock`) — it does not run dockerd inside the Pod.

This imposes a **key constraint**: the daemon that creates sandbox containers is the **node's Docker daemon**, which resolves bind-mount paths against the **node filesystem**. So the Box workspace root must be the **same absolute path** in all three places:

1. The actual path on the node
2. The mount path inside the `langbot-box` container
3. The mount path inside every sandbox container it spawns

This is exactly why this manifest uses a `hostPath` (fixed at `/app/data/box`) instead of a regular PVC: a PVC path only exists inside the Pod's mount namespace, which the node's dockerd cannot see. `langbot` and `langbot-box` are also pinned to the **same node** via `podAffinity` so they share this hostPath.

#### Connection & configuration

- `langbot` connects to the Box runtime over WebSocket, using the endpoint from the ConfigMap: `BOX__RUNTIME__ENDPOINT: ws://langbot-box:5410`.
  > Note: the in-container default hostname is `langbot_box` (with an underscore), which is **not** a valid Kubernetes DNS name. The endpoint must therefore be set **explicitly** to the valid Service name `langbot-box`.
- The Box runtime does **not** read its own `box.local.*` / `BOX__*` environment variables; its configuration is pushed by LangBot via the INIT RPC on connect. So `BOX__LOCAL__*` (`HOST_ROOT` / `DEFAULT_WORKSPACE` / `SKILLS_ROOT` / `ALLOWED_MOUNT_ROOTS`) are set on the `langbot` Deployment, where `HOST_ROOT` must match the `box-root` mountPath on both sides (`/app/data/box`).

#### Security note

Mounting the node's Docker socket grants the Box runtime (and any code executed in the sandbox) effective root on the node. Only deploy Box on nodes you trust for this workload — ideally a dedicated node pool isolated with taints/tolerations. For a stronger isolation boundary, switch `box.backend` to `e2b` (set `E2B_API_KEY`) and drop the docker.sock mount + hostPath.

#### Verify Box is ready

```bash
# Box runtime logs (should show the selected backend, e.g. "using backend: docker")
kubectl logs -n langbot -l app=langbot-box -f

# Confirm langbot connected to the Box runtime
kubectl logs -n langbot -l app=langbot | grep -i "box runtime"
```

### Common Operations

#### View Logs

```bash
# View LangBot main service logs
kubectl logs -n langbot -l app=langbot -f

# View plugin runtime logs
kubectl logs -n langbot -l app=langbot-plugin-runtime -f
```

#### Restart Services

```bash
# Restart LangBot
kubectl rollout restart deployment/langbot -n langbot

# Restart plugin runtime
kubectl rollout restart deployment/langbot-plugin-runtime -n langbot
```

#### Update Images

```bash
# Update to latest version
kubectl set image deployment/langbot -n langbot langbot=rockchin/langbot:latest
kubectl set image deployment/langbot-plugin-runtime -n langbot langbot-plugin-runtime=rockchin/langbot:latest

# Check update status
kubectl rollout status deployment/langbot -n langbot
```

#### Scaling (Not Recommended)

Note: Due to LangBot using ReadWriteOnce persistent storage, multi-replica scaling is not supported. For high availability, consider using ReadWriteMany storage or alternative architectures.

#### Backup Data

```bash
# Backup PVC data
kubectl exec -n langbot -it <langbot-pod-name> -- tar czf /tmp/backup.tar.gz /app/data
kubectl cp langbot/<langbot-pod-name>:/tmp/backup.tar.gz ./backup.tar.gz
```

### Uninstall

```bash
# Delete all resources (keep PVCs)
kubectl delete deployment,service,configmap -n langbot --all

# Delete PVCs (will delete data)
kubectl delete pvc -n langbot --all

# Delete namespace
kubectl delete namespace langbot
```

### Troubleshooting

#### Pods Not Starting

```bash
# Check Pod status
kubectl get pods -n langbot

# View detailed information
kubectl describe pod -n langbot <pod-name>

# View events
kubectl get events -n langbot --sort-by='.lastTimestamp'
```

#### Storage Issues

```bash
# Check PVC status
kubectl get pvc -n langbot

# Check PV
kubectl get pv
```

#### Network Access Issues

```bash
# Check Service
kubectl get svc -n langbot

# Test port forwarding
kubectl port-forward -n langbot svc/langbot 5300:5300
```

### Production Recommendations

1. **Use specific version tags**: Avoid using `latest` tag, use specific version like `rockchin/langbot:v1.0.0`
2. **Configure resource limits**: Adjust CPU and memory limits based on actual load
3. **Use Ingress + TLS**: Configure HTTPS access and certificate management
4. **Configure monitoring and alerts**: Integrate monitoring tools like Prometheus, Grafana
5. **Regular backups**: Configure automated backup strategy to protect data
6. **Use dedicated StorageClass**: Configure high-performance storage for production
7. **Configure affinity rules**: Ensure Pods are scheduled to appropriate nodes

### Advanced Configuration

#### Using Secrets for Sensitive Information

If you need to configure sensitive information like API keys:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: langbot-secrets
  namespace: langbot
type: Opaque
data:
  api_key: <base64-encoded-value>
```

Then reference in Deployment:

```yaml
env:
- name: API_KEY
  valueFrom:
    secretKeyRef:
      name: langbot-secrets
      key: api_key
```

#### Configure Horizontal Pod Autoscaling (HPA)

Note: Requires ReadWriteMany storage type

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: langbot-hpa
  namespace: langbot
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: langbot
  minReplicas: 1
  maxReplicas: 3
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### References

- [LangBot Official Documentation](https://docs.langbot.app)
- [Docker Deployment Guide](https://link.langbot.app/zh/docs/docker)
- [Kubernetes Official Documentation](https://kubernetes.io/docs/)
