# Procedimento de Deploy - Kube News no Kubernetes

Este documento descreve o processo passo a passo para fazer o deploy da aplicação Kube News corrigida e securizada em um cluster Kubernetes.

## 📋 Pré-requisitos

### Ferramentas Necessárias
- **Docker** 20.10+ instalado e configurado
- **kubectl** instalado e configurado para o cluster
- **Git** para versionamento
- Acesso a um **registry Docker** (Docker Hub, AWS ECR, etc.)
- **Cluster Kubernetes** em funcionamento

### Verificação do Ambiente
```bash
# Verificar versões
docker --version
kubectl version --client

# Testar conexão com cluster
kubectl cluster-info
kubectl get nodes
```

## 🚀 Etapa 1: Preparação do Código

### 1.1 Clonar/Atualizar Repositório
```bash
git clone https://github.com/seu-usuario/kube-news.git
cd kube-news
```

### 1.2 Verificar Correções de Segurança
As seguintes vulnerabilidades já foram corrigidas no código:

✅ **SQL Injection** - Validação de ID no endpoint `/post/:id`  
✅ **Input Validation** - Validação completa no `/api/post`  
✅ **Middleware Order** - Body parser antes das rotas  
✅ **Request Limits** - Limites de 10MB implementados  
✅ **Hardcoded Credentials** - Senha obrigatória via environment  
✅ **Rate Limiting** - 100 req/15min (geral), 10 req/15min (API)  
✅ **SSL Configuration** - `rejectUnauthorized: true`  
✅ **Security Headers** - Helmet.js implementado  
✅ **Information Disclosure** - Console.logs removidos  

## 🐳 Etapa 2: Build e Push da Imagem Docker

### 2.1 Build da Imagem
```bash
# Construir imagem
docker build -t kube-news:latest .

# Verificar build
docker images | grep kube-news
```

### 2.2 Teste Local (Opcional)
```bash
# Testar localmente (sem banco)
docker run -p 8080:8080 \
  -e DB_PASSWORD=TestPassword123 \
  -e DB_HOST=localhost \
  kube-news:latest

# Em outro terminal, testar endpoints
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

### 2.3 Push para Registry
```bash
# Login no registry (exemplo: Docker Hub)
docker login

# Tag com versão
docker tag kube-news:latest SEU_USUARIO/kube-news:v1.0.0

# Push da imagem
docker push SEU_USUARIO/kube-news:v1.0.0

# Verificar push
docker search SEU_USUARIO/kube-news
```

## ⚙️ Etapa 3: Configuração dos Manifestos

### 3.1 Atualizar Referência da Imagem
Edite o arquivo `k8s-deployment.yaml` e substitua:
```yaml
# Linha ~262: Alterar de
image: kube-news:latest

# Para
image: SEU_USUARIO/kube-news:v1.0.0
```

### 3.2 Gerar Nova Senha do Banco
```bash
# Gerar senha segura
NEW_PASSWORD="SuaSenhaSeguraAqui$(date +%s)"
echo $NEW_PASSWORD

# Converter para base64
echo -n "$NEW_PASSWORD" | base64

# Copiar resultado e substituir no k8s-deployment.yaml na seção Secret
```

### 3.3 Validar Sintaxe YAML
```bash
# Verificar sintaxe
kubectl apply --dry-run=client -f k8s-deployment.yaml

# Validar recursos
kubectl apply --validate=true --dry-run=client -f k8s-deployment.yaml
```

## 🎯 Etapa 4: Deploy no Cluster

### 4.1 Criar Namespace (Opcional)
```bash
# Criar namespace dedicado
kubectl create namespace kube-news

# OU editar todos os manifests para incluir:
# metadata:
#   namespace: kube-news
```

### 4.2 Aplicar Recursos
```bash
# Deploy completo
kubectl apply -f k8s-deployment.yaml

# Se usando namespace específico:
kubectl apply -f k8s-deployment.yaml -n kube-news

# Verificar recursos criados
kubectl get all
```

### 4.3 Monitorar o Deploy
```bash
# Acompanhar status dos pods
kubectl get pods -w

# Ver logs da aplicação
kubectl logs -l app=kube-news -f

# Ver logs do PostgreSQL
kubectl logs -l app=postgres -f

# Verificar eventos do cluster
kubectl get events --sort-by=.metadata.creationTimestamp
```

## 🔍 Etapa 5: Verificação e Testes

### 5.1 Status dos Componentes
```bash
# Verificar deployments
kubectl get deployments -o wide

# Verificar services
kubectl get services -o wide

# Verificar pods detalhadamente
kubectl get pods -o wide

# Detalhes de um pod específico
kubectl describe pod <NOME_DO_POD>
```

### 5.2 Testar Conectividade do Banco
```bash
# Encontrar pod do PostgreSQL
POSTGRES_POD=$(kubectl get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# Conectar no banco
kubectl exec -it $POSTGRES_POD -- psql -U kubedevnews -d kubedevnews

# Dentro do PostgreSQL:
\l          # Listar databases
\dt         # Listar tabelas
SELECT * FROM "Posts" LIMIT 5;  # Verificar dados
\q          # Sair
```

### 5.3 Testar Aplicação
```bash
# Obter detalhes do service
kubectl get service kube-news-service

# Se LoadBalancer, aguardar EXTERNAL-IP
kubectl get service kube-news-service -w

# Testar endpoints (usando EXTERNAL-IP quando disponível)
EXTERNAL_IP=$(kubectl get service kube-news-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Health checks
curl http://$EXTERNAL_IP/health
curl http://$EXTERNAL_IP/ready

# Página principal
curl http://$EXTERNAL_IP/

# Métricas Prometheus
curl http://$EXTERNAL_IP/metrics
```

### 5.4 Teste com Port-Forward (Alternativa)
```bash
# Criar túnel local
kubectl port-forward service/kube-news-service 8080:80

# Em outro terminal:
curl http://localhost:8080/health
curl http://localhost:8080/ready

# Testar no browser: http://localhost:8080
```

## 📊 Etapa 6: Testes de Funcionalidade

### 6.1 Teste de Criação de Post
```bash
# Via formulário web
curl -X POST http://$EXTERNAL_IP/post \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=Teste&resumo=Resumo de teste&description=Conteúdo do teste"

# Via API
curl -X POST http://$EXTERNAL_IP/api/post \
  -H "Content-Type: application/json" \
  -d '{
    "artigos": [
      {
        "title": "Notícia API",
        "resumo": "Teste da API",
        "description": "Conteúdo enviado via API REST"
      }
    ]
  }'
```

### 6.2 Teste de Rate Limiting
```bash
# Testar limite geral (100 req/15min)
for i in {1..10}; do
  curl -s http://$EXTERNAL_IP/ > /dev/null
  echo "Request $i completed"
done

# Testar limite da API (10 req/15min)
for i in {1..15}; do
  curl -s -X POST http://$EXTERNAL_IP/api/post \
    -H "Content-Type: application/json" \
    -d '{"artigos":[]}' || echo "Rate limited at request $i"
done
```

### 6.3 Teste de Segurança
```bash
# Testar SQL injection (deve ser bloqueado)
curl "http://$EXTERNAL_IP/post/1'; DROP TABLE Posts;--"

# Testar validação de entrada (deve retornar erro 400)
curl -X POST http://$EXTERNAL_IP/api/post \
  -H "Content-Type: application/json" \
  -d '{"artigos": "invalid_data"}'
```

## 🔧 Etapa 7: Operações de Manutenção

### 7.1 Scaling Manual
```bash
# Escalar para 5 réplicas
kubectl scale deployment kube-news-deployment --replicas=5

# Verificar scaling
kubectl get pods -l app=kube-news

# Voltar para 3 réplicas
kubectl scale deployment kube-news-deployment --replicas=3
```

### 7.2 Atualização da Aplicação
```bash
# Atualizar imagem
kubectl set image deployment/kube-news-deployment \
  kube-news=SEU_USUARIO/kube-news:v1.1.0

# Acompanhar rolling update
kubectl rollout status deployment/kube-news-deployment

# Verificar histórico
kubectl rollout history deployment/kube-news-deployment
```

### 7.3 Rollback (Se Necessário)
```bash
# Rollback para versão anterior
kubectl rollout undo deployment/kube-news-deployment

# Rollback para versão específica
kubectl rollout undo deployment/kube-news-deployment --to-revision=1
```

## 📈 Etapa 8: Monitoramento

### 8.1 Logs da Aplicação
```bash
# Logs em tempo real
kubectl logs -f -l app=kube-news

# Logs com timestamps
kubectl logs -l app=kube-news --timestamps=true

# Logs das últimas 1 hora
kubectl logs -l app=kube-news --since=1h
```

### 8.2 Métricas de Recursos
```bash
# CPU e memória dos pods
kubectl top pods

# CPU e memória dos nós
kubectl top nodes

# Detalhes de um pod específico
kubectl describe pod <NOME_DO_POD>
```

### 8.3 Health Checks
```bash
# Status dos deployments
kubectl get deployments

# Verificar readiness probes
kubectl get pods -o wide

# Testar health endpoint diretamente
kubectl exec -it <POD_NAME> -- curl localhost:8080/health
```

## ❗ Etapa 9: Troubleshooting

### 9.1 Pod em CrashLoopBackOff
```bash
# Ver logs do pod com problema
kubectl logs <POD_NAME> --previous

# Descrever pod para ver eventos
kubectl describe pod <POD_NAME>

# Verificar configuração
kubectl get pod <POD_NAME> -o yaml
```

### 9.2 Banco de Dados Não Conecta
```bash
# Verificar service do PostgreSQL
kubectl get svc postgres-service

# Testar conectividade
kubectl exec -it <KUBE_NEWS_POD> -- nc -zv postgres-service 5432

# Verificar secrets
kubectl get secret kube-news-secret -o yaml
```

### 9.3 LoadBalancer Sem IP Externo
```bash
# Verificar service
kubectl describe service kube-news-service

# Usar NodePort como alternativa
kubectl patch service kube-news-service -p '{"spec":{"type":"NodePort"}}'

# Obter NodePort
kubectl get service kube-news-service
```

## 🧹 Etapa 10: Limpeza (Opcional)

### 10.1 Remover Aplicação
```bash
# Remover todos os recursos
kubectl delete -f k8s-deployment.yaml

# Se usando namespace:
kubectl delete namespace kube-news

# Verificar limpeza
kubectl get all
```

### 10.2 Limpeza Local
```bash
# Remover imagens Docker
docker rmi kube-news:latest
docker rmi SEU_USUARIO/kube-news:v1.0.0

# Limpeza de containers parados
docker system prune -f
```

## 📊 Recursos Criados no Cluster

| Recurso | Nome | Descrição |
|---------|------|-----------|
| Secret | kube-news-secret | Senha do banco de dados |
| ConfigMap | kube-news-config | Variáveis de ambiente |
| Deployment | postgres-deployment | Banco PostgreSQL |
| Deployment | kube-news-deployment | Aplicação principal |
| Service | postgres-service | Serviço interno do banco |
| Service | kube-news-service | Serviço da aplicação |
| ServiceMonitor | kube-news-monitor | Monitoramento Prometheus |

## 🔒 Aspectos de Segurança Implementados

- ✅ **Rate Limiting**: Proteção contra ataques de força bruta
- ✅ **Input Validation**: Validação rigorosa de todos os inputs
- ✅ **SQL Injection Protection**: Parâmetros validados e sanitizados
- ✅ **Security Headers**: Helmet.js configurado
- ✅ **Non-root Container**: Usuário sem privilégios
- ✅ **Resource Limits**: Limites de CPU e memória
- ✅ **Health Checks**: Liveness e readiness probes
- ✅ **SSL/TLS Support**: Configurável para banco de dados
- ✅ **Secrets Management**: Senhas não expostas em código

## 📞 Suporte e Documentação

### Comandos Úteis de Debug
```bash
# Status geral
kubectl get all -o wide

# Eventos do cluster
kubectl get events --sort-by=.metadata.creationTimestamp

# Logs estruturados
kubectl logs -l app=kube-news --tail=100

# Shell no pod (para debug)
kubectl exec -it <POD_NAME> -- /bin/sh

# Port-forward para testes
kubectl port-forward <POD_NAME> 8080:8080
```

### Verificações de Saúde
```bash
# Script de verificação completa
#!/bin/bash
echo "=== Verificação de Saúde Kube-News ==="
echo "Pods:"
kubectl get pods -l app=kube-news
echo -e "\nServices:"
kubectl get svc
echo -e "\nHealth Check:"
kubectl exec -it $(kubectl get pod -l app=kube-news -o jsonpath='{.items[0].metadata.name}') -- curl -s localhost:8080/health
```

---

**✅ Deploy Concluído com Sucesso!**

A aplicação Kube News está agora executando de forma segura no seu cluster Kubernetes com todas as vulnerabilidades corrigidas e práticas de segurança implementadas.

Para acessar: http://\<EXTERNAL_IP\> ou via port-forward em http://localhost:8080