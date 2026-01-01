# Vercel 自定义域名配置指南

## 🎯 目标
将 `blog.zxt.net.cn` 配置为 Vercel 应用的访问域名。

---

## 📋 当前状态

从 Vercel 控制台可以看到：
- 域名：`blog.zxt.net.cn`
- 状态：**Invalid Configuration**（配置无效）
- 需要配置 DNS 记录

---

## 🔧 解决方案（两种方式）

### 方式一：使用 CNAME 记录（推荐，更简单）

如果你的域名注册商支持 CNAME 记录，使用这种方式：

#### 步骤：

1. **登录你的域名注册商/DNS服务商**
   - 例如：阿里云、腾讯云、GoDaddy、Cloudflare 等
   - 找到域名管理/DNS 管理页面

2. **添加 CNAME 记录**
   
   在 DNS 管理页面添加以下记录：
   
   | 记录类型 | 主机记录 | 记录值 | TTL |
   |---------|---------|--------|-----|
   | CNAME | blog | `131ca3db1b3f9db5.vercel-dns-017.com.` | 600（或默认）|
   
   **重要提示**：
   - 主机记录填写：`blog`（不带域名后缀）
   - 记录值填写：`131ca3db1b3f9db5.vercel-dns-017.com.`（注意末尾的点）
   - 如果域名是 `blog.zxt.net.cn`，主机记录就是 `blog`

3. **保存并等待生效**
   - 保存 DNS 记录
   - 等待 5-30 分钟让 DNS 传播
   - 在 Vercel 控制台点击 **Refresh** 按钮

---

### 方式二：使用 Vercel DNS（需要修改 nameservers）

如果你想使用 Vercel 的 DNS 服务：

#### 步骤：

1. **获取 Vercel 的 Nameservers**
   - 在 Vercel 控制台的域名设置中，切换到 **Vercel DNS** 标签
   - 你会看到两个 nameservers：
     - `ns1.vercel-dns.com`
     - `ns2.vercel-dns.com`

2. **在域名注册商处修改 Nameservers**
   - 登录你的域名注册商
   - 找到域名管理 → Nameservers/DNS 服务器设置
   - 将 nameservers 修改为：
     - `ns1.vercel-dns.com`
     - `ns2.vercel-dns.com`
   - 保存更改

3. **等待生效**
   - Nameservers 更改可能需要 24-48 小时生效
   - 生效后，Vercel 会自动管理 DNS 记录

---

## 🔍 常见问题排查

### 问题 1：DNS 记录已添加但 Vercel 仍显示 Invalid Configuration

#### 检查清单：

1. **确认记录类型正确**
   - 必须是 **CNAME** 记录
   - 不是 A 记录或其他类型

2. **确认主机记录正确**
   - 对于 `blog.zxt.net.cn`，主机记录应该是 `blog`
   - 不是 `blog.zxt.net.cn` 或 `@`

3. **确认记录值正确**
   - 记录值：`131ca3db1b3f9db5.vercel-dns-017.com.`
   - 注意末尾有一个点 `.`
   - 不要有多余的空格

4. **等待 DNS 传播**
   - DNS 更改通常需要 5-30 分钟生效
   - 最长可能需要 48 小时（但通常很快）

5. **清除 DNS 缓存**
   ```bash
   # macOS/Linux
   sudo dscacheutil -flushcache
   sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   ```

---

### 问题 2：如何验证 DNS 配置是否正确

#### 方法 1：使用命令行工具

```bash
# 检查 CNAME 记录
dig blog.zxt.net.cn CNAME

# 或使用 nslookup
nslookup -type=CNAME blog.zxt.net.cn

# 或使用 host 命令
host -t CNAME blog.zxt.net.cn
```

**期望结果**：
```
blog.zxt.net.cn canonical name = 131ca3db1b3f9db5.vercel-dns-017.com.
```

#### 方法 2：使用在线工具

访问以下网站检查 DNS：
- [https://dnschecker.org](https://dnschecker.org)
- [https://www.whatsmydns.net](https://www.whatsmydns.net)
- [https://mxtoolbox.com](https://mxtoolbox.com)

输入 `blog.zxt.net.cn`，选择 CNAME 记录类型，查看全球 DNS 解析情况。

---

### 问题 3：域名注册商不支持 CNAME 记录

如果 `zxt.net.cn` 是根域名，某些注册商可能不支持根域名的 CNAME 记录。

**解决方案**：
- 使用 A 记录指向 Vercel 的 IP（不推荐，IP 可能变化）
- 或者使用子域名（如 `blog.zxt.net.cn`），子域名通常支持 CNAME

---

## 📝 不同域名注册商的配置示例

### 阿里云

1. 登录阿里云控制台
2. 进入 **域名** → **解析设置**
3. 点击 **添加记录**
4. 填写：
   - 记录类型：`CNAME`
   - 主机记录：`blog`
   - 记录值：`131ca3db1b3f9db5.vercel-dns-017.com.`
   - TTL：`600`
5. 保存

### 腾讯云

1. 登录腾讯云控制台
2. 进入 **域名注册** → **我的域名** → **解析**
3. 点击 **添加记录**
4. 填写：
   - 主机记录：`blog`
   - 记录类型：`CNAME`
   - 线路类型：`默认`
   - 记录值：`131ca3db1b3f9db5.vercel-dns-017.com.`
   - TTL：`600`
5. 保存

### Cloudflare

1. 登录 Cloudflare 控制台
2. 选择域名 `zxt.net.cn`
3. 进入 **DNS** 设置
4. 点击 **Add record**
5. 填写：
   - Type: `CNAME`
   - Name: `blog`
   - Target: `131ca3db1b3f9db5.vercel-dns-017.com.`
   - Proxy status: 可以选择 **DNS only**（灰色云朵）或 **Proxied**（橙色云朵）
6. 保存

---

## ✅ 配置完成后的验证步骤

### 1. 验证 DNS 记录

```bash
# 检查 CNAME 记录
dig blog.zxt.net.cn CNAME +short
# 应该返回：131ca3db1b3f9db5.vercel-dns-017.com.
```

### 2. 在 Vercel 中刷新

1. 进入 Vercel 项目 → **Settings** → **Domains**
2. 找到 `blog.zxt.net.cn`
3. 点击 **Refresh** 按钮
4. 等待几秒钟，状态应该变为 **Valid Configuration**

### 3. 测试访问

1. 等待 5-30 分钟让 DNS 完全传播
2. 在浏览器中访问：`https://blog.zxt.net.cn`
3. 应该能看到你的应用

---

## 🔄 如果配置后仍然无效

### 检查清单：

- [ ] DNS 记录类型是 CNAME（不是 A 记录）
- [ ] 主机记录是 `blog`（不是 `blog.zxt.net.cn`）
- [ ] 记录值末尾有点 `.`
- [ ] 记录值没有多余空格
- [ ] 已经等待至少 5-10 分钟
- [ ] 使用 `dig` 或 `nslookup` 验证 DNS 记录已生效
- [ ] 在 Vercel 中点击了 **Refresh** 按钮
- [ ] 清除了本地 DNS 缓存

### 如果还是不行：

1. **检查是否有其他 DNS 记录冲突**
   - 确保没有其他 A 记录或 CNAME 记录指向 `blog`
   - 删除冲突的记录

2. **联系域名注册商支持**
   - 确认域名注册商是否支持子域名的 CNAME 记录
   - 询问是否有特殊配置要求

3. **尝试使用 Vercel DNS**
   - 切换到 **Vercel DNS** 方式
   - 修改 nameservers（需要等待更长时间）

---

## 💡 推荐配置流程

1. **在域名注册商添加 CNAME 记录**
   - 主机记录：`blog`
   - 记录值：`131ca3db1b3f9db5.vercel-dns-017.com.`

2. **等待 10-15 分钟**

3. **验证 DNS 记录**
   ```bash
   dig blog.zxt.net.cn CNAME
   ```

4. **在 Vercel 中刷新**
   - 点击 **Refresh** 按钮

5. **测试访问**
   - 访问 `https://blog.zxt.net.cn`

---

## 🎉 配置成功标志

当配置成功后，你应该看到：

1. **Vercel 控制台**：
   - 域名状态变为 **Valid Configuration**（绿色勾）
   - 不再显示红色警告

2. **浏览器访问**：
   - `https://blog.zxt.net.cn` 可以正常访问
   - 显示你的应用内容

3. **SSL 证书**：
   - Vercel 会自动为你的域名配置 SSL 证书
   - 支持 HTTPS 访问

---

祝你配置顺利！如果遇到问题，请告诉我具体的错误信息。🚀



