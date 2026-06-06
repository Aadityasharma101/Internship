from django import forms

from news.models import Article, Category


class ArticleForm(forms.ModelForm):
    class Meta:
        model = Article
        fields = (
            'title',
            'category',
            'excerpt',
            'content',
            'featured_image',
            'featured_image_url',
            'status',
            'is_breaking',
        )
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'category': forms.Select(attrs={'class': 'form-select'}),
            'excerpt': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'content': forms.Textarea(attrs={'class': 'form-control', 'rows': 10}),
            'featured_image': forms.FileInput(attrs={'class': 'form-control'}),
            'featured_image_url': forms.URLInput(attrs={'class': 'form-control', 'placeholder': 'Or paste image URL'}),
            'status': forms.Select(attrs={'class': 'form-select'}),
            'is_breaking': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['category'].queryset = Category.objects.all()
        self.fields['featured_image'].required = False
        self.fields['featured_image_url'].required = False
