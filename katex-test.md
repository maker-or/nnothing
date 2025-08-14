# KaTeX Math Rendering Test

This file tests complex mathematical formulas using standard KaTeX delimiters.

## Display Math Examples

### Layer Normalization Formula
$$
X' = \text{LayerNorm}(X + \tilde{X})
$$

### Feed Forward Network
$$
\text{FFN}(x) = \max(0, xW_1 + b_1)W_2 + b_2
$$

### Positional Encoding (Aligned Equations)
$$
\begin{aligned}
PE_{(pos,2i)}   &= \sin\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right) \\
PE_{(pos,2i+1)} &= \cos\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right)
\end{aligned}
$$

### Input Computation
$$
\text{Input}_t = \text{Embedding}_t + PE_t
$$

### Attention Mechanism
$$
\text{Attention}(Q,K,V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V
$$

### Multi-Head Attention
$$
\text{MultiHead}(Q,K,V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)W^O
$$

where $\text{head}_i = \text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$

## Complex Mathematical Expressions

### Loss Function
$$
\mathcal{L} = -\frac{1}{N} \sum_{i=1}^{N} \log P(y_i | x_i; \theta)
$$

### Gradient
$$
\nabla_{\theta} \mathcal{L} = \frac{\partial \mathcal{L}}{\partial \theta}
$$

### Matrix Operations
$$
\mathbf{A} = \begin{pmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{pmatrix}
$$

### Probability Distribution
$$
P(x) = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)
$$

### Integration
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### Summation
$$
\sum_{k=0}^{n} \binom{n}{k} x^k y^{n-k} = (x+y)^n
$$

### Complex Fractions
$$
\frac{d}{dx}\left(\frac{u}{v}\right) = \frac{v\frac{du}{dx} - u\frac{dv}{dx}}{v^2}
$$

## Inline Math Examples

The multi-head attention computes $\tilde{X} = \text{MultiHead}(X,X,X)$ where $X \in \mathbb{R}^{N \times d_{\text{model}}}$ represents the input sequence.

The model dimension is $d_{\text{model}}$ and the positional encoding matrix is $P \in \mathbb{R}^{N_{\max}\times d_{\text{model}}}$.

For optimization, we use the Adam optimizer with learning rate $\alpha = 10^{-4}$ and weight decay $\lambda = 10^{-2}$.

The softmax function is defined as $\text{softmax}(x_i) = \frac{e^{x_i}}{\sum_{j} e^{x_j}}$.

## Advanced LaTeX Features

### Greek Letters and Special Symbols
$$
\alpha, \beta, \gamma, \delta, \epsilon, \zeta, \eta, \theta, \iota, \kappa, \lambda, \mu, \nu, \xi, \pi, \rho, \sigma, \tau, \upsilon, \phi, \chi, \psi, \omega
$$

### Mathematical Sets
$$
\mathbb{R}, \mathbb{C}, \mathbb{N}, \mathbb{Z}, \mathbb{Q}, \mathbb{F}, \mathbb{P}
$$

### Operators and Relations
$$
\forall x \in \mathbb{R}, \exists y \in \mathbb{R} \text{ such that } x \leq y \text{ and } x \neq y
$$

### Limits
$$
\lim_{x \to \infty} \frac{1}{x} = 0
$$

### Derivatives
$$
\frac{\partial^2 f}{\partial x^2} + \frac{\partial^2 f}{\partial y^2} = 0
$$

### Vectors and Matrices
$$
\vec{v} = \begin{bmatrix} v_1 \\ v_2 \\ v_3 \end{bmatrix}, \quad \mathbf{M} = \begin{bmatrix} m_{11} & m_{12} \\ m_{21} & m_{22} \end{bmatrix}
$$

### Equation Systems
$$
\begin{cases}
x + y = 1 \\
2x - y = 0
\end{cases}
$$

### Large Operators
$$
\bigcup_{i=1}^n A_i, \quad \bigcap_{i=1}^n B_i, \quad \bigoplus_{i=1}^n C_i
$$

This comprehensive test covers various mathematical notation patterns that should render correctly with KaTeX using standard `$$...$$` and `$...$` delimiters.
