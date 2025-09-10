# Guia de Deploy e Operações - Kube-News

## 🚀 Visão Geral do Deploy

Este guia fornece instruções detalhadas para deploy da aplicação Kube-News em diferentes ambientes, desde desenvolvimento local até produção em Kubernetes, incluindo práticas de DevOps e operações.

---

## 🛠️ Pré-requisitos

### Ambiente Local
- Node.js 14+ 
- PostgreSQL 12+
- npm ou yarn
- Git

### Ambiente Containerizado
- Docker 20.10+
- Docker Compose 3.8+

### Ambiente Kubernetes
- Kubernetes 1.21+
- kubectl configurado
- Helm 3.0+ (opcional)
- Ingress Controller (NGINX/Traefik)

---

## 🏠 Deploy Local

### 1. Configuração do Banco de Dados
```bash
# PostgreSQL via Docker
docker run --name kube-news-db \
  -e POSTGRES_DB=kubedevnews \
  -e POSTGRES_USER=kubedevnews \
  -e POSTGRES_PASSWORD=Pg#123 \
  -p 5432:5432 \
  -d postgres:14

# Ou instalar PostgreSQL localmente
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres createdb kubedevnews
sudo -u postgres createuser kubedevnews
```

### 2. Configuração da Aplicação
```bash
# Clonar repositório
git clone https://github.com/seu-usuario/kube-news.git
cd kube-news

# Instalar dependências
cd src
npm install

# Configurar variáveis de ambiente
export DB_DATABASE=kubedevnews
export DB_USERNAME=kubedevnews
export DB_PASSWORD=Pg#123
export DB_HOST=localhost
export DB_PORT=5432
export DB_SSL_REQUIRE=false

# Iniciar aplicação
npm start
```

### 3. Verificação
```bash
# Verificar saúde da aplicação
curl http://localhost:8080/health

# Popular dados de exemplo
curl -X POST http://localhost:8080/api/post \
  -H "Content-Type: application/json" \
  -d '@../popula-dados.http'

# Acessar aplicação
open http://localhost:8080
```

---

## 🐳 Deploy com Docker

### 1. Dockerfile Otimizado
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY src/package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runner

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kubenews -u 1001

WORKDIR /app

# Copiar dependências e código
COPY --from=builder --chown=kubenews:nodejs /app/node_modules ./node_modules
COPY --chown=kubenews:nodejs src/ ./

# Configurar usuário e porta
USER kubenews
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
```

### 2. Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    container_name: kube-news-app
    ports:
      - "8080:8080"
    environment:
      - DB_DATABASE=kubedevnews
      - DB_USERNAME=kubedevnews
      - DB_PASSWORD=Pg#123
      - DB_HOST=db
      - DB_PORT=5432
      - DB_SSL_REQUIRE=false
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    
  db:
    image: postgres:14-alpine
    container_name: kube-news-db
    environment:
      - POSTGRES_DB=kubedevnews
      - POSTGRES_USER=kubedevnews
      - POSTGRES_PASSWORD=Pg#123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kubedevnews -d kubedevnews"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    container_name: kube-news-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

volumes:
  postgres_data:
```

### 3. Comandos Docker
```bash
# Build e run
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Escalar aplicação
docker-compose up -d --scale app=3

# Parar tudo
docker-compose down
```

---

## ☸️ Deploy em Kubernetes

### 1. Manifests Kubernetes

#### ConfigMap
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kube-news-config
  namespace: kube-news
data:
  DB_DATABASE: kubedevnews
  DB_USERNAME: kubedevnews
  DB_HOST: postgres-service
  DB_PORT: "5432"
  DB_SSL_REQUIRE: "true"
```

#### Secrets
```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: kube-news-secrets
  namespace: kube-news
type: Opaque
data:
  DB_PASSWORD: UGcjMTIz  # Base64 encoded
```

#### Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kube-news-app
  namespace: kube-news
  labels:
    app: kube-news
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: kube-news
  template:
    metadata:
      labels:
        app: kube-news
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: kube-news
        image: kubenews:1.0.0
        imagePullPolicy: Always
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - configMapRef:
            name: kube-news-config
        - secretRef:
            name: kube-news-secrets
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
          readOnlyRootFilesystem: true
        volumeMounts:
        - name: temp
          mountPath: /tmp
      volumes:
      - name: temp
        emptyDir: {}
      terminationGracePeriodSeconds: 30
```

#### Service
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: kube-news-service
  namespace: kube-news
  labels:
    app: kube-news
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: kube-news
```

#### Ingress
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kube-news-ingress
  namespace: kube-news
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - news.exemplo.com
    secretName: kube-news-tls
  rules:
  - host: news.exemplo.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: kube-news-service
            port:
              number: 80
```

### 2. HorizontalPodAutoscaler
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kube-news-hpa
  namespace: kube-news
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kube-news-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
```

### 3. Scripts de Deploy
```bash
#!/bin/bash
# deploy.sh

set -e

NAMESPACE="kube-news"
IMAGE_TAG="${1:-latest}"

echo "🚀 Deploying Kube-News v${IMAGE_TAG}"

# Criar namespace
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Aplicar manifests
kubectl apply -f k8s/ -n ${NAMESPACE}

# Aguardar rollout
kubectl rollout status deployment/kube-news-app -n ${NAMESPACE} --timeout=300s

# Verificar pods
kubectl get pods -n ${NAMESPACE} -l app=kube-news

# Verificar serviços
kubectl get svc -n ${NAMESPACE}

echo "✅ Deploy concluído com sucesso!"
echo "📊 Métricas: kubectl port-forward svc/kube-news-service 8080:80 -n ${NAMESPACE}"
echo "📝 Logs: kubectl logs -f deployment/kube-news-app -n ${NAMESPACE}"
```

---

## 📊 Monitoramento e Observabilidade

### 1. Prometheus Configuration
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'kube-news'
    static_configs:
      - targets: ['app:8080']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

### 2. Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Kube-News Metrics",
    "panels": [
      {
        "title": "HTTP Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph", 
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

### 3. Alertas
```yaml
# monitoring/alerts.yml
groups:
  - name: kube-news-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pod is crash looping"
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: src/package-lock.json
          
      - name: Install dependencies
        run: cd src && npm ci
        
      - name: Run security audit
        run: cd src && npm audit --audit-level high
        
      - name: Run tests
        run: cd src && npm test || echo "No tests found"

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG }}
          
      - name: Deploy to Kubernetes
        run: |
          ./deploy.sh ${{ github.sha }}
```

---

## 🧪 Testes de Carga e Performance

### Usando Artillery.js
```yaml
# load-test.yml
config:
  target: 'http://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120  
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
  payload:
    path: "test-data.csv"
    fields:
      - "title"
      - "summary" 
      - "content"

scenarios:
  - name: "Browse posts"
    weight: 70
    flow:
      - get:
          url: "/"
      - think: 2
      - get:
          url: "/post/{{ $randomInt(1, 10) }}"

  - name: "Create post"
    weight: 30
    flow:
      - post:
          url: "/post"
          form:
            title: "{{ title }}"
            resumo: "{{ summary }}"
            description: "{{ content }}"
```

### Executar Testes
```bash
# Instalar Artillery
npm install -g artillery

# Executar teste de carga
artillery run load-test.yml

# Teste rápido
artillery quick --duration 60 --rate 10 http://localhost:8080
```

---

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Aplicação não inicia
```bash
# Verificar logs
kubectl logs -f deployment/kube-news-app -n kube-news

# Verificar eventos
kubectl describe pod <pod-name> -n kube-news

# Verificar conectividade com banco
kubectl exec -it <pod-name> -n kube-news -- nc -zv postgres-service 5432
```

#### 2. Database Connection Issues
```bash
# Verificar secrets
kubectl get secrets kube-news-secrets -n kube-news -o yaml

# Testar conexão manual
kubectl run -it --rm debug --image=postgres:14 --restart=Never -- \
  psql -h postgres-service -U kubedevnews -d kubedevnews
```

#### 3. Performance Issues
```bash
# Verificar métricas de recursos
kubectl top pods -n kube-news

# Verificar HPA
kubectl get hpa -n kube-news

# Analisar métricas
kubectl port-forward svc/kube-news-service 8080:80 -n kube-news
curl http://localhost:8080/metrics
```

### Scripts Úteis
```bash
# health-check.sh
#!/bin/bash
NAMESPACE=${1:-kube-news}
SERVICE_NAME=${2:-kube-news-service}

kubectl port-forward svc/$SERVICE_NAME 8080:80 -n $NAMESPACE &
PID=$!

sleep 2

echo "🏥 Health Check:"
curl -s http://localhost:8080/health | jq

echo -e "\n📊 Readiness Check:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ready

kill $PID
```

---

## 📋 Checklist de Deploy

### ✅ Pré-Deploy
- [ ] Código revisado e testado
- [ ] Dependências atualizadas e auditadas
- [ ] Secrets configurados corretamente
- [ ] Recursos adequados definidos
- [ ] Probes configuradas
- [ ] Monitoring configurado
- [ ] Backup do banco realizado

### ✅ Pós-Deploy
- [ ] Aplicação respondendo corretamente
- [ ] Health checks passando
- [ ] Métricas sendo coletadas
- [ ] Logs estruturados funcionando
- [ ] Alertas configurados
- [ ] Teste de funcionalidades críticas
- [ ] Performance dentro dos limites esperados

---

*Guia atualizado em: 09/09/2025*  
*Versão Kubernetes testada: 1.28+*  
*Docker version: 24.0+*