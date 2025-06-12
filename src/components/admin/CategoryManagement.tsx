import React, { useState } from 'react';
import { 
  Folder, 
  Plus, 
  Search, 
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Package
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string;
  products: number;
  subcategories: Category[];
  isExpanded?: boolean;
}

const CategoryManagement = () => {
  const [categories, setCategories] = useState<Category[]>([
    {
      id: '1',
      name: 'Utilities',
      description: 'Essential tools and utilities for daily use',
      products: 25,
      subcategories: [
        {
          id: '1-1',
          name: 'System Tools',
          description: 'System maintenance and optimization tools',
          products: 10,
          subcategories: []
        },
        {
          id: '1-2',
          name: 'Productivity',
          description: 'Tools to enhance your productivity',
          products: 15,
          subcategories: []
        }
      ]
    },
    {
      id: '2',
      name: 'Games',
      description: 'Entertainment and gaming applications',
      products: 50,
      subcategories: [
        {
          id: '2-1',
          name: 'Action',
          description: 'Fast-paced action games',
          products: 20,
          subcategories: []
        },
        {
          id: '2-2',
          name: 'Puzzle',
          description: 'Brain-teasing puzzle games',
          products: 30,
          subcategories: []
        }
      ]
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');

  const toggleCategory = (categoryId: string) => {
    setCategories(prevCategories => {
      const updateCategory = (cats: Category[]): Category[] => {
        return cats.map(cat => {
          if (cat.id === categoryId) {
            return { ...cat, isExpanded: !cat.isExpanded };
          }
          if (cat.subcategories.length > 0) {
            return { ...cat, subcategories: updateCategory(cat.subcategories) };
          }
          return cat;
        });
      };
      return updateCategory(prevCategories);
    });
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const hasSubcategories = category.subcategories.length > 0;
    const isExpanded = category.isExpanded;

    return (
      <div key={category.id}>
        <div 
          className={`flex items-center p-4 hover:bg-gray-700/30 transition-colors ${
            level > 0 ? 'ml-6' : ''
          }`}
        >
          <button
            onClick={() => toggleCategory(category.id)}
            className="p-1 hover:bg-gray-600 rounded-lg transition-colors"
          >
            {hasSubcategories ? (
              isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )
            ) : (
              <div className="w-5 h-5" />
            )}
          </button>
          <div className="flex-1 flex items-center space-x-4">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
              <Folder className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{category.name}</div>
              <div className="text-sm text-gray-400">{category.description}</div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">{category.products}</span>
              </div>
              <button className="p-1 text-blue-400 hover:text-blue-300 transition-colors">
                <Edit2 className="w-5 h-5" />
              </button>
              <button className="p-1 text-red-400 hover:text-red-300 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        {hasSubcategories && isExpanded && (
          <div className="border-l border-gray-700/50">
            {category.subcategories.map(subcategory => 
              renderCategory(subcategory, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Category Management</h2>
        <button className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          <Plus className="w-5 h-5" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Categories List */}
      <div className="bg-gray-800/50 rounded-xl overflow-hidden">
        {categories.map(category => renderCategory(category))}
      </div>
    </div>
  );
};

export default CategoryManagement; 