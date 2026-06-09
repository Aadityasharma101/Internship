from django import forms


class ArticleForm(forms.Form):
    title = forms.CharField(
        max_length=255,
        widget=forms.TextInput(attrs={'class': 'form-control'}),
    )
    category_id = forms.ChoiceField(
        label='Category',
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
    )
    category_name = forms.CharField(
        label='New category name',
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Use only if category is not listed'}),
    )
    body = forms.CharField(
        label='Content',
        widget=forms.Textarea(attrs={'class': 'form-control', 'rows': 10}),
    )
    image = forms.URLField(
        label='Image URL',
        required=False,
        widget=forms.URLInput(attrs={'class': 'form-control', 'placeholder': 'https://example.com/news-image.jpg'}),
    )

    def __init__(self, *args, categories=None, **kwargs):
        super().__init__(*args, **kwargs)
        category_choices = [('', 'Select category')]
        for category in categories or []:
            category_choices.append((str(category.id), category.name))
        self.fields['category_id'].choices = category_choices

    def clean(self):
        cleaned_data = super().clean()
        if not cleaned_data.get('category_id') and not cleaned_data.get('category_name'):
            raise forms.ValidationError('Choose an existing category or enter a new category name.')
        return cleaned_data

    def to_api_payload(self, author_name=''):
        payload = {
            'title': self.cleaned_data['title'],
            'body': self.cleaned_data['body'],
            'image': self.cleaned_data.get('image') or None,
            'author_name': author_name,
        }
        if self.cleaned_data.get('category_id'):
            payload['category_id'] = self.cleaned_data['category_id']
        if self.cleaned_data.get('category_name'):
            payload['category_name'] = self.cleaned_data['category_name']
        return payload


class PasswordChangeForm(forms.Form):
    old_password = forms.CharField(
        label='Current password',
        widget=forms.PasswordInput(attrs={'class': 'form-control'}),
    )
    new_password = forms.CharField(
        label='New password',
        widget=forms.PasswordInput(attrs={'class': 'form-control'}),
    )
    new_password2 = forms.CharField(
        label='Confirm new password',
        widget=forms.PasswordInput(attrs={'class': 'form-control'}),
    )

    def clean(self):
        cleaned_data = super().clean()
        if cleaned_data.get('new_password') != cleaned_data.get('new_password2'):
            raise forms.ValidationError('New passwords do not match.')
        return cleaned_data

    def to_api_payload(self):
        return {
            'old_password': self.cleaned_data['old_password'],
            'new_password': self.cleaned_data['new_password'],
            'new_password2': self.cleaned_data['new_password2'],
        }
