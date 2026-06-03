from django.contrib import admin

from .models import Article, ArticleStats, ArticleTag, Bookmark, Category, Tag


class ArticleTagInline(admin.TabularInline):
    model = ArticleTag
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'category', 'status', 'is_breaking', 'published_at')
    list_filter = ('status', 'is_breaking', 'category')
    search_fields = ('title', 'content')
    prepopulated_fields = {'slug': ('title',)}
    inlines = [ArticleTagInline]
    readonly_fields = ('created_at', 'updated_at')


@admin.register(ArticleStats)
class ArticleStatsAdmin(admin.ModelAdmin):
    list_display = ('article', 'views_count', 'last_viewed_at')
    readonly_fields = ('article',)


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ('user', 'article', 'created_at')
    list_filter = ('created_at',)
