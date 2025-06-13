import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Eye, Search, Filter, RefreshCw, Star, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabaseClient';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  status: 'active' | 'draft' | 'archived';
  creator_id: string;
  created_at: string;
  updated_at: string;
  rating?: number;
  sales_count?: number;
  image_url?: string;
}

const RealProductManagement: React.FC = () => {
  const { hasPermission, user, reportSecurityEvent } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'digital',
    status: 'draft' as const
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      // For now, create mock products since we don't have a products table in Supabase
      const mockProducts: Product[] = [
        {
          id: 'prod-1',
          name: 'Sacred NFT Collection',
          description: 'Divine digital artifacts blessed by cosmic energy',
          price: 100.5,
          category: 'nft',
          status: 'active',
          creator_id: user?.id || 'sacred-creator',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          rating: 4.8,
          sales_count: 25,
          image_url: ''
        },
        {
          id: 'prod-2', 
          name: 'Mystical TON Smart Contract',
          description: 'Pre-built smart contract templates for sacred dApps',
          price: 250.0,
          category: 'smart-contract',
          status: 'active',
          creator_id: user?.id || 'dev-creator',
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          rating: 5.0,
          sales_count: 12,
          image_url: ''
        },
        {
          id: 'prod-3',
          name: 'Dharma Marketplace Template',
          description: 'Complete marketplace solution built with React and TON',
          price: 500.0,
          category: 'template',
          status: 'draft',
          creator_id: 'template-master',
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          rating: 4.5,
          sales_count: 8,
          image_url: ''
        },
        {
          id: 'prod-4',
          name: 'Cosmic Analytics Dashboard',
          description: 'Advanced analytics for TON blockchain applications',
          price: 75.25,
          category: 'tool',
          status: 'archived',
          creator_id: 'analytics-guru',
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          rating: 4.2,
          sales_count: 45,
          image_url: ''
        }
      ];

      setProducts(mockProducts);

      reportSecurityEvent({
        type: 'data_access',
        severity: 'info',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          action: 'view_products',
          product_count: mockProducts.length
        }
      });

    } catch (err) {
      console.error('Error loading products:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async () => {
    if (!newProduct.name || !newProduct.description || newProduct.price <= 0) {
      alert('Please fill all required fields with valid data');
      return;
    }

    try {
      const product: Product = {
        id: `prod-${Date.now()}`,
        ...newProduct,
        creator_id: user?.id || 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        rating: 0,
        sales_count: 0
      };

      setProducts(prev => [product, ...prev]);

      reportSecurityEvent({
        type: 'data_access',
        severity: 'info',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          action: 'create_product',
          product_name: newProduct.name,
          creator: user?.email
        }
      });

      setNewProduct({ name: '', description: '', price: 0, category: 'digital', status: 'draft' });
      setShowProductModal(false);
    } catch (err) {
      console.error('Error creating product:', err);
      alert('Failed to create product: ' + (err as Error).message);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      setProducts(prev => prev.filter(p => p.id !== productId));

      reportSecurityEvent({
        type: 'data_access',
        severity: 'warning',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          action: 'delete_product',
          product_id: productId,
          operator: user?.email
        }
      });
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Failed to delete product: ' + (err as Error).message);
    }
  };

  const updateProductStatus = async (productId: string, newStatus: Product['status']) => {
    try {
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, status: newStatus, updated_at: new Date().toISOString() } : p
      ));

      reportSecurityEvent({
        type: 'data_access',
        severity: 'info',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          action: 'update_product_status',
          product_id: productId,
          new_status: newStatus,
          operator: user?.email
        }
      });
    } catch (err) {
      console.error('Error updating product status:', err);
      alert('Failed to update product status: ' + (err as Error).message);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'draft': return 'text-yellow-400 bg-yellow-500/20';
      case 'archived': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'nft': return 'text-purple-400 bg-purple-500/20';
      case 'smart-contract': return 'text-blue-400 bg-blue-500/20';
      case 'template': return 'text-green-400 bg-green-500/20';
      case 'tool': return 'text-orange-400 bg-orange-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (!hasPermission('products', 'read')) {
    return (
      <div className="text-center p-8 bg-red-500/10 rounded-lg">
        <Package className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h3 className="text-xl font-bold text-red-400 mb-2">Access Denied</h3>
        <p className="text-gray-400">You don't have permission to view product management.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Package className="mr-3 text-green-400" />
          Product Management 🛍️
        </h2>
        <div className="flex space-x-2">
          <button 
            onClick={loadProducts}
            disabled={loading}
            className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {hasPermission('products', 'create') && (
            <button 
              onClick={() => setShowProductModal(true)}
              className="bg-green-500/20 text-green-300 px-4 py-2 rounded-lg hover:bg-green-500/30 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-blue-500/50 focus:outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-blue-500/50 focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="nft">NFT</option>
          <option value="smart-contract">Smart Contract</option>
          <option value="template">Template</option>
          <option value="tool">Tool</option>
          <option value="digital">Digital</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-blue-500/50 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{products.length}</div>
          <div className="text-gray-400 text-sm">Total Products</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{products.filter(p => p.status === 'active').length}</div>
          <div className="text-gray-400 text-sm">Active</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{products.filter(p => p.status === 'draft').length}</div>
          <div className="text-gray-400 text-sm">Draft</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{products.reduce((sum, p) => sum + (p.sales_count || 0), 0)}</div>
          <div className="text-gray-400 text-sm">Total Sales</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">{products.reduce((sum, p) => sum + p.price * (p.sales_count || 0), 0).toFixed(1)} TON</div>
          <div className="text-gray-400 text-sm">Revenue</div>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center p-8">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4 text-blue-400" />
          <p className="text-gray-400">Loading divine products... ✨</p>
        </div>
      ) : error ? (
        <div className="text-center p-8 bg-red-500/10 rounded-lg">
          <Package className="w-8 h-8 mx-auto mb-4 text-red-400" />
          <p className="text-red-400 font-semibold">Error loading products</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button onClick={loadProducts} className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg mb-2">{product.name}</h3>
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{product.description}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${getCategoryColor(product.category)}`}>
                  {product.category.toUpperCase()}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(product.status)}`}>
                  {product.status.toUpperCase()}
                </span>
              </div>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-white font-bold">{product.price} TON</span>
                  </div>
                  {product.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400">{product.rating}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-xs text-gray-500 mb-4">
                Sales: {product.sales_count || 0} • Created: {new Date(product.created_at).toLocaleDateString()}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedProduct(product)}
                  className="flex-1 bg-blue-500/20 text-blue-300 py-2 px-3 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center justify-center space-x-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>View</span>
                </button>
                
                {hasPermission('products', 'update') && (
                  <select
                    value={product.status}
                    onChange={(e) => updateProductStatus(product.id, e.target.value as Product['status'])}
                    className="bg-white/5 border border-white/10 rounded-lg text-white text-sm px-2 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                )}
                
                {hasPermission('products', 'delete') && (
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="bg-red-500/20 text-red-300 py-2 px-3 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Create New Product</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Product Name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
              />
              <textarea
                placeholder="Description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
                rows={3}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price (TON)"
                value={newProduct.price}
                onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
              />
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              >
                <option value="digital">Digital</option>
                <option value="nft">NFT</option>
                <option value="smart-contract">Smart Contract</option>
                <option value="template">Template</option>
                <option value="tool">Tool</option>
              </select>
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={createProduct}
                className="flex-1 bg-green-500/20 text-green-300 py-2 rounded-lg hover:bg-green-500/30 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowProductModal(false)}
                className="flex-1 bg-gray-500/20 text-gray-300 py-2 rounded-lg hover:bg-gray-500/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Product Details</h3>
            <div className="space-y-4">
              <div>
                <span className="text-gray-400 text-sm">Name:</span>
                <div className="text-white font-medium">{selectedProduct.name}</div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Description:</span>
                <div className="text-white">{selectedProduct.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 text-sm">Price:</span>
                  <div className="text-green-400 font-bold">{selectedProduct.price} TON</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Category:</span>
                  <div className={getCategoryColor(selectedProduct.category)}>{selectedProduct.category}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Status:</span>
                  <div className={getStatusColor(selectedProduct.status)}>{selectedProduct.status}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Sales:</span>
                  <div className="text-white">{selectedProduct.sales_count || 0}</div>
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Created:</span>
                <div className="text-white">{new Date(selectedProduct.created_at).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Last Updated:</span>
                <div className="text-white">{new Date(selectedProduct.updated_at).toLocaleString()}</div>
              </div>
              {selectedProduct.rating && (
                <div>
                  <span className="text-gray-400 text-sm">Rating:</span>
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-400 font-bold">{selectedProduct.rating}/5</span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedProduct(null)}
              className="w-full mt-6 bg-blue-500/20 text-blue-300 py-2 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-gray-400 text-sm">
          🛍️ Complete product lifecycle management for your TON marketplace
        </p>
      </div>
    </div>
  );
};

export default RealProductManagement; 