module.exports = function()
{
    this.normalizeParcelNumber = function(parcel_num)
    {
        if ( parcel_num == null ) return null;

        var sanitized_parcel = parcel_num.replace('-', '');
        while ( sanitized_parcel.indexOf('-') >= 0 )
        {
            sanitized_parcel = sanitized_parcel.replace('-', ''); // Search ignores hyphens
        }
        sanitized_parcel = sanitized_parcel.toUpperCase(); // Search ignores case

        return sanitized_parcel;
    }
}